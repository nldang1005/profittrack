import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { format } from "date-fns";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from") || format(new Date(Date.now() - 29 * 86400000), "yyyy-MM-dd");
  const toStr = searchParams.get("to") || format(new Date(), "yyyy-MM-dd");

  const from = new Date(fromStr + "T00:00:00.000Z");
  const to = new Date(toStr + "T23:59:59.999Z");

  const store = await prisma.store.findFirst({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ products: [], storeName: "", currency: "USD" });

  const lineItems = await prisma.lineItem.findMany({
    where: { order: { storeId: store.id, createdAt: { gte: from, lte: to }, financialStatus: { in: ["paid", "partially_refunded"] } } },
    include: { order: { select: { id: true } } },
  });

  const productMap = new Map<string, { title: string; vendor?: string; orders: Set<string>; unitsSold: number; revenue: number; cogs: number }>();

  for (const item of lineItems) {
    const key = item.productId || item.title;
    const existing = productMap.get(key) || { title: item.title, orders: new Set(), unitsSold: 0, revenue: 0, cogs: 0 };
    existing.orders.add(item.order.id);
    existing.unitsSold += item.quantity;
    existing.revenue += item.totalPrice;
    existing.cogs += item.cost * item.quantity;
    productMap.set(key, existing);
  }

  const products = Array.from(productMap.entries()).map(([id, p]) => {
    const grossProfit = p.revenue - p.cogs;
    return {
      id,
      title: p.title,
      vendor: "",
      orders: p.orders.size,
      unitsSold: p.unitsSold,
      revenue: Math.round(p.revenue * 100) / 100,
      cogs: Math.round(p.cogs * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      margin: p.revenue > 0 ? Math.round((grossProfit / p.revenue) * 1000) / 10 : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({ products, storeName: store.shopName, currency: store.currency });
}
