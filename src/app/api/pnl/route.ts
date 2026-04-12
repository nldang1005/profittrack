import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { format, eachWeekOfInterval, endOfWeek, startOfWeek } from "date-fns";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from") || format(new Date(Date.now() - 29 * 86400000), "yyyy-MM-dd");
  const toStr = searchParams.get("to") || format(new Date(), "yyyy-MM-dd");

  const from = new Date(fromStr + "T00:00:00.000Z");
  const to = new Date(toStr + "T23:59:59.999Z");

  const store = await prisma.store.findFirst({
    where: { userId: session.user.id },
  });

  if (!store) {
    return NextResponse.json({
      storeName: "",
      currency: "USD",
      dateLabel: `${fromStr} – ${toStr}`,
      grossRevenue: 0,
      refunds: 0,
      netRevenue: 0,
      cogs: 0,
      shippingCost: 0,
      transactionFees: 0,
      adSpend: 0,
      otherExpenses: 0,
      grossProfit: 0,
      grossMargin: 0,
      netProfit: 0,
      netMargin: 0,
      weeklyData: [],
    });
  }

  const orders = await prisma.order.findMany({
    where: {
      storeId: store.id,
      createdAt: { gte: from, lte: to },
      financialStatus: { in: ["paid", "partially_refunded"] },
    },
  });

  const adSpendRecords = await prisma.adSpend.findMany({
    where: {
      adAccount: { storeId: store.id },
      date: { gte: from, lte: to },
    },
  });

  const expenses = await prisma.expense.findMany({
    where: {
      storeId: store.id,
      startDate: { lte: to },
      OR: [{ endDate: null }, { endDate: { gte: from } }],
    },
  });

  const grossRevenue = orders.reduce((s, o) => s + o.totalPrice, 0);
  const refunds = orders.reduce((s, o) => s + o.totalRefunds, 0);
  const netRevenue = grossRevenue - refunds;
  const cogs = orders.reduce((s, o) => s + o.cogs, 0);
  const shippingCost = orders.reduce((s, o) => s + o.shippingCost, 0);
  const transactionFees = orders.reduce((s, o) => s + o.transactionFees, 0);
  const adSpend = adSpendRecords.reduce((s, r) => s + r.spend, 0);

  // Calculate pro-rated expenses
  const daysDiff = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
  const otherExpenses = expenses.reduce((s, e) => {
    if (e.frequency === "monthly") return s + (e.amount * daysDiff) / 30;
    if (e.frequency === "weekly") return s + (e.amount * daysDiff) / 7;
    if (e.frequency === "one_time") return s + e.amount;
    return s + e.amount;
  }, 0);

  const grossProfit = netRevenue - cogs - shippingCost - transactionFees;
  const netProfit = grossProfit - adSpend - otherExpenses;
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  // Weekly breakdown
  const weeks = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
  const weeklyData = weeks.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const clampedEnd = weekEnd > to ? to : weekEnd;

    const wOrders = orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= weekStart && d <= clampedEnd;
    });
    const wSpend = adSpendRecords.filter((r) => {
      const d = new Date(r.date);
      return d >= weekStart && d <= clampedEnd;
    });

    const wRevenue = wOrders.reduce((s, o) => s + o.totalPrice - o.totalRefunds, 0);
    const wCogs = wOrders.reduce((s, o) => s + o.cogs, 0);
    const wShipping = wOrders.reduce((s, o) => s + o.shippingCost, 0);
    const wFees = wOrders.reduce((s, o) => s + o.transactionFees, 0);
    const wAdSpend = wSpend.reduce((s, r) => s + r.spend, 0);
    const wNetProfit = wRevenue - wCogs - wShipping - wFees - wAdSpend;

    return {
      week: `${format(weekStart, "MMM d")} – ${format(clampedEnd, "MMM d")}`,
      revenue: Math.round(wRevenue * 100) / 100,
      cogs: Math.round(wCogs * 100) / 100,
      adSpend: Math.round(wAdSpend * 100) / 100,
      netProfit: Math.round(wNetProfit * 100) / 100,
    };
  });

  return NextResponse.json({
    storeName: store.shopName,
    currency: store.currency,
    dateLabel: `${fromStr} – ${toStr}`,
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    refunds: Math.round(refunds * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
    shippingCost: Math.round(shippingCost * 100) / 100,
    transactionFees: Math.round(transactionFees * 100) / 100,
    adSpend: Math.round(adSpend * 100) / 100,
    otherExpenses: Math.round(otherExpenses * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossMargin: Math.round(grossMargin * 10) / 10,
    netProfit: Math.round(netProfit * 100) / 100,
    netMargin: Math.round(netMargin * 10) / 10,
    weeklyData,
  });
}
