import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { format, eachDayOfInterval, parseISO } from "date-fns";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from") || "2026-03-20";
  const toStr = searchParams.get("to") || format(new Date(), "yyyy-MM-dd");

  const from = new Date(fromStr + "T00:00:00.000Z");
  const to = new Date(toStr + "T23:59:59.999Z");

  // Get user's first store
  const store = await prisma.store.findFirst({
    where: { userId: session.user.id },
    include: { adAccounts: true },
  });

  if (!store) {
    return NextResponse.json({
      hasStore: false,
      hasFacebook: false,
      revenue: 0,
      cogs: 0,
      adSpend: 0,
      grossProfit: 0,
      netProfit: 0,
      netMargin: 0,
      roas: 0,
      orders: 0,
      aov: 0,
      currency: "USD",
      storeName: "",
      chartData: [],
      spendBreakdown: [],
      topProducts: [],
    });
  }

  const hasFacebook = store.adAccounts.some((a) => a.platform === "facebook" && a.isActive);

  // Fetch orders in range
  const orders = await prisma.order.findMany({
    where: {
      storeId: store.id,
      createdAt: { gte: from, lte: to },
      financialStatus: { in: ["paid", "partially_refunded"] },
    },
    include: { lineItems: true },
  });

  // Fetch ad spend in range
  const adSpendRecords = await prisma.adSpend.findMany({
    where: {
      adAccount: { storeId: store.id },
      date: { gte: from, lte: to },
    },
  });

  // Aggregate metrics
  const revenue = orders.reduce((s, o) => s + o.totalPrice - o.totalRefunds, 0);
  const cogs = orders.reduce((s, o) => s + o.cogs, 0);
  const shippingTotal = orders.reduce((s, o) => s + o.shippingCost, 0);
  const feesTotal = orders.reduce((s, o) => s + o.transactionFees, 0);
  const adSpend = adSpendRecords.reduce((s, r) => s + r.spend, 0);
  const grossProfit = revenue - cogs - shippingTotal - feesTotal;
  const netProfit = grossProfit - adSpend;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const roas = adSpend > 0 ? revenue / adSpend : 0;
  const orderCount = orders.length;
  const aov = orderCount > 0 ? revenue / orderCount : 0;

  // Chart data - group by day
  const days = eachDayOfInterval({ start: from, end: to });
  const chartData = days.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayOrders = orders.filter((o) => format(new Date(o.createdAt), "yyyy-MM-dd") === dayStr);
    const daySpend = adSpendRecords.filter((r) => format(new Date(r.date), "yyyy-MM-dd") === dayStr);

    const dayRevenue = dayOrders.reduce((s, o) => s + o.totalPrice - o.totalRefunds, 0);
    const dayCogs = dayOrders.reduce((s, o) => s + o.cogs, 0);
    const dayAdSpend = daySpend.reduce((s, r) => s + r.spend, 0);
    const dayShipping = dayOrders.reduce((s, o) => s + o.shippingCost, 0);
    const dayFees = dayOrders.reduce((s, o) => s + o.transactionFees, 0);
    const dayNetProfit = dayRevenue - dayCogs - dayShipping - dayFees - dayAdSpend;

    return {
      date: format(day, "MMM d"),
      revenue: Math.round(dayRevenue * 100) / 100,
      cogs: Math.round(dayCogs * 100) / 100,
      adSpend: Math.round(dayAdSpend * 100) / 100,
      netProfit: Math.round(dayNetProfit * 100) / 100,
    };
  });

  // Spend breakdown pie
  const spendBreakdown = [
    { name: "COGS", value: Math.round(cogs * 100) / 100 },
    { name: "Ad Spend", value: Math.round(adSpend * 100) / 100 },
    { name: "Shipping", value: Math.round(shippingTotal * 100) / 100 },
    { name: "Fees", value: Math.round(feesTotal * 100) / 100 },
  ].filter((d) => d.value > 0);

  // Top products
  const productMap = new Map<string, { title: string; orders: number; revenue: number; profit: number }>();
  for (const order of orders) {
    for (const item of order.lineItems) {
      const key = item.productId || item.title;
      const existing = productMap.get(key) || { title: item.title, orders: 0, revenue: 0, profit: 0 };
      existing.orders += item.quantity;
      existing.revenue += item.totalPrice;
      existing.profit += item.totalPrice - item.cost * item.quantity;
      productMap.set(key, existing);
    }
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return NextResponse.json({
    hasStore: true,
    hasFacebook,
    revenue: Math.round(revenue * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
    shipping: Math.round(shippingTotal * 100) / 100,
    fees: Math.round(feesTotal * 100) / 100,
    adSpend: Math.round(adSpend * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    netMargin: Math.round(netMargin * 10) / 10,
    roas: Math.round(roas * 100) / 100,
    orders: orderCount,
    aov: Math.round(aov * 100) / 100,
    currency: store.currency,
    storeName: store.shopName,
    chartData,
    spendBreakdown,
    topProducts,
  });
}
