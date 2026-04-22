import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { format, subDays } from "date-fns";

const CAMPAIGN_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#06b6d4","#f97316"];

function roasStatus(roas: number) {
  if (roas >= 2.5) return "xuất sắc (≥2.5x)";
  if (roas >= 1.5) return "tốt (≥1.5x)";
  if (roas >= 1)   return "sát hòa vốn (≥1x)";
  return "đang lỗ (<1x)";
}

export async function GET(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY chưa được cấu hình" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from") || format(subDays(new Date(), 29), "yyyy-MM-dd");
  const toStr   = searchParams.get("to")   || format(new Date(), "yyyy-MM-dd");

  const from = new Date(fromStr + "T00:00:00.000Z");
  const to   = new Date(toStr   + "T23:59:59.999Z");

  const store = await prisma.store.findFirst({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ error: "No store" }, { status: 400 });

  const spends = await prisma.adSpend.findMany({
    where: { adAccount: { storeId: store.id }, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });

  if (spends.length === 0) {
    return NextResponse.json({ error: "Không có dữ liệu ads trong khoảng thời gian này" }, { status: 400 });
  }

  // Aggregate by campaign
  const campaignMap = new Map<string, any>();
  for (const s of spends) {
    const key = s.campaignId || "unknown";
    const ex  = campaignMap.get(key) || { campaignId: key, campaignName: s.campaignName, spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    ex.spend       += s.spend;
    ex.impressions += s.impressions;
    ex.clicks      += s.clicks;
    ex.purchases   += s.purchases;
    ex.revenue     += s.revenue;
    campaignMap.set(key, ex);
  }

  const campaigns = Array.from(campaignMap.values())
    .map((c, i) => ({ ...c, roas: c.spend > 0 ? c.revenue / c.spend : 0, color: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length] }))
    .sort((a, b) => b.spend - a.spend);

  const totalSpend     = spends.reduce((s, r) => s + r.spend, 0);
  const totalRevenue   = spends.reduce((s, r) => s + r.revenue, 0);
  const totalClicks    = spends.reduce((s, r) => s + r.clicks, 0);
  const totalPurchases = spends.reduce((s, r) => s + r.purchases, 0);
  const totalImpressions = spends.reduce((s, r) => s + r.impressions, 0);
  const overallRoas    = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const cpa            = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
  const cpc            = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpm            = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

  // Trend: first half vs second half
  const midTs = (from.getTime() + to.getTime()) / 2;
  const firstHalf  = spends.filter(s => new Date(s.date).getTime() < midTs);
  const secondHalf = spends.filter(s => new Date(s.date).getTime() >= midTs);
  const halfRoas   = (arr: typeof spends) => {
    const sp = arr.reduce((a, r) => a + r.spend, 0);
    const rv = arr.reduce((a, r) => a + r.revenue, 0);
    return sp > 0 ? rv / sp : 0;
  };
  const roas1 = halfRoas(firstHalf);
  const roas2 = halfRoas(secondHalf);
  const trendDelta = roas2 - roas1;
  const trend = trendDelta > 0.1 ? "cải thiện" : trendDelta < -0.1 ? "giảm sút" : "ổn định";

  // Active campaigns (last 4 days)
  const activeCutoff = subDays(new Date(), 4);
  const activeCampaignIds = new Set(
    spends.filter(s => new Date(s.date) >= activeCutoff && s.spend > 0).map(s => s.campaignId)
  );
  const activeCampaigns = campaigns.filter(c => activeCampaignIds.has(c.campaignId));

  // Build prompt
  const dateLabel = `${format(from, "dd/MM/yyyy")} – ${format(to, "dd/MM/yyyy")}`;

  const campaignRows = campaigns.map((c, i) =>
    `${i + 1}. **${c.campaignName || c.campaignId}**\n` +
    `   - Chi tiêu: $${c.spend.toFixed(2)} | Doanh thu: $${c.revenue.toFixed(2)} | ROAS: ${c.roas.toFixed(2)}x (${roasStatus(c.roas)})\n` +
    `   - Clicks: ${c.clicks} | Purchases: ${c.purchases} | CPA: ${c.purchases > 0 ? "$" + (c.spend / c.purchases).toFixed(2) : "N/A"}\n` +
    `   - Active gần đây: ${activeCampaignIds.has(c.campaignId) ? "✅ Có" : "❌ Không"}`
  ).join("\n\n");

  const prompt =
`Phân tích hiệu suất quảng cáo Facebook Ads cho store "${store.shopName}" trong khoảng thời gian **${dateLabel}**.

## 📊 Tổng quan kỳ
- Tổng chi tiêu: $${totalSpend.toFixed(2)}
- Tổng doanh thu từ ads: $${totalRevenue.toFixed(2)}
- ROAS tổng thể: **${overallRoas.toFixed(2)}x**
- Xu hướng ROAS: ${trend} (nửa đầu ${roas1.toFixed(2)}x → nửa sau ${roas2.toFixed(2)}x, delta ${trendDelta > 0 ? "+" : ""}${trendDelta.toFixed(2)})
- CPC: $${cpc.toFixed(2)} | CPA: $${cpa.toFixed(2)} | CPM: $${cpm.toFixed(2)}
- Tổng clicks: ${totalClicks.toLocaleString()} | Tổng đơn: ${totalPurchases} | Tổng impressions: ${totalImpressions.toLocaleString()}
- Số chiến dịch: ${campaigns.length} tổng / ${activeCampaigns.length} đang active

## 📋 Chi tiết chiến dịch
${campaignRows}

---

Hãy đưa ra phân tích toàn diện gồm:

1. **Đánh giá tổng thể** — hiệu suất kỳ này so với benchmark ngành e-commerce (ROAS tốt: 2-4x, xuất sắc: >4x), nhận xét xu hướng.

2. **Phân tích từng chiến dịch active** — điểm mạnh/yếu, nguyên nhân có thể giải thích ROAS hiện tại, mức độ ưu tiên.

3. **Kế hoạch hành động cụ thể:**
   - Scale: chiến dịch nào, tăng budget bao nhiêu %, điều kiện để tăng tiếp
   - Tối ưu: campaign nào cần thay đổi creative/audience/bidding
   - Dừng/Tạm dừng: campaign nào đang drain budget mà không có kết quả
   - Phân bổ ngân sách đề xuất (% theo campaign)

4. **Bước tiếp theo trong 7-14 ngày tới** — danh sách ưu tiên các việc cần làm cụ thể.

5. **Cảnh báo & Cơ hội** — điều gì cần chú ý, cơ hội chưa được khai thác.

Trả lời bằng tiếng Việt, rõ ràng, thực tiễn và có thể hành động ngay.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = await client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: "Bạn là chuyên gia phân tích quảng cáo Facebook Ads cho e-commerce, đặc biệt với các sản phẩm dropshipping. Bạn hiểu sâu về scaling, ROAS, creative testing, và audience targeting. Hãy phân tích chính xác, thực tiễn và đưa ra hành động cụ thể.",
    messages: [{ role: "user", content: prompt }],
  });

  // Stream text chunks back to client
  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(enc.encode(chunk.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.controller.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
