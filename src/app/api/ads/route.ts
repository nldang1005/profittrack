import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { format, eachDayOfInterval } from "date-fns";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from") || format(new Date(Date.now() - 29 * 86400000), "yyyy-MM-dd");
  const toStr = searchParams.get("to") || format(new Date(), "yyyy-MM-dd");

  const from = new Date(fromStr + "T00:00:00.000Z");
  const to = new Date(toStr + "T23:59:59.999Z");

  const store = await prisma.store.findFirst({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ storeName: "", currency: "USD", totalSpend: 0, campaigns: [], dailySpend: [] });

  const spends = await prisma.adSpend.findMany({
    where: { adAccount: { storeId: store.id }, date: { gte: from, lte: to } },
    orderBy: { spend: "desc" },
  });

  const totalSpend = spends.reduce((s, r) => s + r.spend, 0);
  const totalImpressions = spends.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = spends.reduce((s, r) => s + r.clicks, 0);
  const totalPurchases = spends.reduce((s, r) => s + r.purchases, 0);
  const totalRevenue = spends.reduce((s, r) => s + r.revenue, 0);

  // Campaign aggregation
  const campaignMap = new Map<string, any>();
  for (const spend of spends) {
    const key = spend.campaignId || "unknown";
    const existing = campaignMap.get(key) || {
      campaignId: key,
      campaignName: spend.campaignName,
      spend: 0,
      impressions: 0,
      clicks: 0,
      purchases: 0,
      revenue: 0,
    };
    existing.spend += spend.spend;
    existing.impressions += spend.impressions;
    existing.clicks += spend.clicks;
    existing.purchases += spend.purchases;
    existing.revenue += spend.revenue;
    campaignMap.set(key, existing);
  }

  const campaigns = Array.from(campaignMap.values())
    .map((c) => ({ ...c, roas: c.spend > 0 ? c.revenue / c.spend : 0 }))
    .sort((a, b) => b.spend - a.spend);

  // Daily spend
  const days = eachDayOfInterval({ start: from, end: to });
  const dailySpend = days.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const daySpends = spends.filter((r) => format(new Date(r.date), "yyyy-MM-dd") === dayStr);
    return {
      date: format(day, "MMM d"),
      spend: Math.round(daySpends.reduce((s, r) => s + r.spend, 0) * 100) / 100,
      revenue: Math.round(daySpends.reduce((s, r) => s + r.revenue, 0) * 100) / 100,
    };
  });

  return NextResponse.json({
    storeName: store.shopName,
    currency: store.currency,
    totalSpend: Math.round(totalSpend * 100) / 100,
    totalImpressions,
    totalClicks,
    totalPurchases,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    roas: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0,
    cpc: totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0,
    cpa: totalPurchases > 0 ? Math.round((totalSpend / totalPurchases) * 100) / 100 : 0,
    cpm: totalImpressions > 0 ? Math.round((totalSpend / totalImpressions) * 1000 * 100) / 100 : 0,
    campaigns,
    dailySpend,
  });
}
