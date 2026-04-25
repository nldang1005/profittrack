import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { format, eachDayOfInterval, subDays } from "date-fns";

const CAMPAIGN_COLORS = ["#6366f1","#f59e0b","#10b981","#ef4444","#8b5cf6","#06b6d4","#f97316"];

function roasStatus(roas: number): "excellent" | "good" | "warning" | "danger" | "inactive" {
  if (roas >= 2.5) return "excellent";
  if (roas >= 1.5) return "good";
  if (roas >= 1)   return "warning";
  return "danger";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from") || format(subDays(new Date(), 29), "yyyy-MM-dd");
  const toStr   = searchParams.get("to")   || format(new Date(), "yyyy-MM-dd");

  const from = new Date(fromStr + "T00:00:00.000Z");
  const to   = new Date(toStr   + "T23:59:59.999Z");

  const store = await prisma.store.findFirst({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ storeName: "", currency: "USD", totalSpend: 0, campaigns: [], dailySpend: [], dailyByCampaign: [], insights: null });

  const spends = await prisma.adSpend.findMany({
    where: { adAccount: { storeId: store.id }, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });

  const totalSpend     = spends.reduce((s, r) => s + r.spend, 0);
  const totalImpressions = spends.reduce((s, r) => s + r.impressions, 0);
  const totalClicks    = spends.reduce((s, r) => s + r.clicks, 0);
  const totalPurchases = spends.reduce((s, r) => s + r.purchases, 0);
  const totalRevenue   = spends.reduce((s, r) => s + r.revenue, 0);

  // ── Campaign aggregation ────────────────────────────────────────────────────
  const campaignMap = new Map<string, any>();
  for (const spend of spends) {
    const key = spend.campaignId || "unknown";
    const ex  = campaignMap.get(key) || { campaignId: key, campaignName: spend.campaignName, spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    ex.spend       += spend.spend;
    ex.impressions += spend.impressions;
    ex.clicks      += spend.clicks;
    ex.purchases   += spend.purchases;
    ex.revenue     += spend.revenue;
    campaignMap.set(key, ex);
  }

  const campaigns = Array.from(campaignMap.values())
    .map((c, i) => ({ ...c, roas: c.spend > 0 ? c.revenue / c.spend : 0, color: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length] }))
    .sort((a, b) => b.spend - a.spend);

  // ── Daily totals ────────────────────────────────────────────────────────────
  const days = eachDayOfInterval({ start: from, end: to });
  const dailySpend = days.map((day) => {
    const ds  = format(day, "yyyy-MM-dd");
    const row = spends.filter(r => format(new Date(r.date), "yyyy-MM-dd") === ds);
    return {
      date:    format(day, "MMM d"),
      spend:   Math.round(row.reduce((s, r) => s + r.spend, 0)   * 100) / 100,
      revenue: Math.round(row.reduce((s, r) => s + r.revenue, 0) * 100) / 100,
    };
  });

  // ── Daily ROAS by campaign (top 6 by spend) ─────────────────────────────────
  const topCampaigns = campaigns.slice(0, 6);
  const dailyByCampaign = days.map((day) => {
    const ds    = format(day, "yyyy-MM-dd");
    const entry: any = { date: format(day, "MMM d") };
    for (const c of topCampaigns) {
      const rows  = spends.filter(r => r.campaignId === c.campaignId && format(new Date(r.date), "yyyy-MM-dd") === ds);
      const sp    = rows.reduce((a, r) => a + r.spend, 0);
      const rev   = rows.reduce((a, r) => a + r.revenue, 0);
      entry[c.campaignId] = sp > 0 ? Math.round((rev / sp) * 100) / 100 : null;
    }
    return entry;
  });

  // ── Insights ────────────────────────────────────────────────────────────────
  // Active = had spend on the most recent synced day (not a fixed 4-day window).
  // Facebook API only returns rows for days with spend > 0, so a paused campaign
  // won't appear on days after it was paused — accurate after the next sync.
  const sortedDays = [...new Set(spends.map(s => format(new Date(s.date), "yyyy-MM-dd")))].sort();
  const lastDataDay = sortedDays.length > 0 ? sortedDays[sortedDays.length - 1] : null;
  const activeCampaignIds = new Set(
    lastDataDay
      ? spends.filter(s => format(new Date(s.date), "yyyy-MM-dd") === lastDataDay && s.spend > 0).map(s => s.campaignId)
      : []
  );
  const activeCampaigns = campaigns.filter(c => activeCampaignIds.has(c.campaignId));

  // Trend: compare first half vs second half of period
  const midTs = (from.getTime() + to.getTime()) / 2;
  const firstHalf  = spends.filter(s => new Date(s.date).getTime() < midTs);
  const secondHalf = spends.filter(s => new Date(s.date).getTime() >= midTs);
  const roasHalf = (arr: typeof spends) => {
    const sp = arr.reduce((a, r) => a + r.spend, 0);
    const rv = arr.reduce((a, r) => a + r.revenue, 0);
    return sp > 0 ? rv / sp : 0;
  };
  const roas1 = roasHalf(firstHalf);
  const roas2 = roasHalf(secondHalf);
  const trendDelta = Math.round((roas2 - roas1) * 100) / 100;
  const overallTrend: "improving" | "declining" | "stable" =
    trendDelta > 0.1 ? "improving" : trendDelta < -0.1 ? "declining" : "stable";

  // Per-campaign ROAS trend (compare first vs second half for that campaign)
  const campaignRoasTrend = (campaignId: string): number => {
    const cs = spends.filter(s => s.campaignId === campaignId);
    const h2 = cs.filter(s => new Date(s.date).getTime() >= midTs);
    if (h2.reduce((a, r) => a + r.spend, 0) < 20) return 0; // not enough data in second half
    return roasHalf(h2) - roasHalf(cs.filter(s => new Date(s.date).getTime() < midTs));
  };

  // Campaign display status (includes monitoring for low-spend)
  const campaignStatus = (c: { roas: number; spend: number; purchases: number }): string => {
    if (c.spend < 200) return "monitoring";
    if (c.purchases === 0) return "danger";
    return roasStatus(c.roas);
  };

  // Per-campaign recommendations
  const recommendations: { type: string; campaign: string; message: string }[] = [];

  // Overall trend alerts (highest priority — shown first)
  if (overallTrend === "declining") {
    recommendations.push({ type: "alert", campaign: "Tổng thể", message: `ROAS giảm ${Math.abs(trendDelta).toFixed(2)} điểm so với nửa đầu kỳ. Xem lại creative và frequency.` });
  }
  if (overallTrend === "improving") {
    recommendations.push({ type: "positive", campaign: "Tổng thể", message: `ROAS tăng ${trendDelta.toFixed(2)} điểm — chiến dịch đang cải thiện tốt.` });
  }

  for (const c of activeCampaigns) {
    // Spend < $200 → chưa đủ dữ liệu, theo dõi thêm
    if (c.spend < 200) {
      recommendations.push({ type: "monitoring", campaign: c.campaignName, message: `Đã chi $${c.spend.toFixed(0)} — chưa đủ dữ liệu để đánh giá (ngưỡng $200). Tiếp tục theo dõi.` });
      continue;
    }

    // Spend >= $200 nhưng chưa ra đơn nào → cảnh báo dừng ngay
    if (c.purchases === 0) {
      recommendations.push({ type: "pause", campaign: c.campaignName, message: `Đã chi $${c.spend.toFixed(0)} nhưng chưa ra đơn nào. Nên dừng hoặc thay đổi creative/target ngay.` });
      continue;
    }

    // ROAS đang tăng dần → khuyến nghị tăng budget
    const roasDelta = campaignRoasTrend(c.campaignId);
    if (roasDelta >= 0.4 && c.roas >= 1.5) {
      recommendations.push({ type: "scale_up", campaign: c.campaignName, message: `ROAS đang tăng dần (+${roasDelta.toFixed(2)} so với nửa đầu kỳ, hiện ${c.roas.toFixed(2)}x). Cân nhắc tăng budget 15–20%.` });
      continue;
    }

    // Đánh giá theo ROAS tổng thể
    const status = roasStatus(c.roas);
    if (status === "danger") {
      recommendations.push({ type: "pause", campaign: c.campaignName, message: `ROAS ${c.roas.toFixed(2)}x — đang lỗ. Dừng hoặc thay đổi creative/target ngay.` });
    } else if (status === "warning") {
      recommendations.push({ type: "optimize", campaign: c.campaignName, message: `ROAS ${c.roas.toFixed(2)}x — sát hòa vốn. Thử A/B test creative mới hoặc thu hẹp audience.` });
    } else if (status === "excellent") {
      recommendations.push({ type: "scale", campaign: c.campaignName, message: `ROAS ${c.roas.toFixed(2)}x — xuất sắc. Tăng budget 20–30% để scale.` });
    }
  }

  const insights = {
    overallTrend,
    trendDelta,
    lastDataDay,
    activeCampaigns: activeCampaigns.map(c => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      roas: Math.round(c.roas * 100) / 100,
      spend: Math.round(c.spend * 100) / 100,
      purchases: c.purchases,
      status: campaignStatus(c),
      color: c.color,
    })),
    recommendations,
  };

  return NextResponse.json({
    storeName: store.shopName,
    currency: store.currency,
    totalSpend:       Math.round(totalSpend * 100) / 100,
    totalImpressions,
    totalClicks,
    totalPurchases,
    totalRevenue:     Math.round(totalRevenue * 100) / 100,
    roas: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0,
    cpc:  totalClicks    > 0 ? Math.round((totalSpend / totalClicks)    * 100) / 100 : 0,
    cpa:  totalPurchases > 0 ? Math.round((totalSpend / totalPurchases) * 100) / 100 : 0,
    cpm:  totalImpressions > 0 ? Math.round((totalSpend / totalImpressions) * 1000 * 100) / 100 : 0,
    campaigns,
    dailySpend,
    dailyByCampaign,
    topCampaigns: topCampaigns.map(c => ({ campaignId: c.campaignId, campaignName: c.campaignName, color: c.color })),
    insights,
  });
}
