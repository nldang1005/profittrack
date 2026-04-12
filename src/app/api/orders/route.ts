import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { format } from "date-fns";

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
    return NextResponse.json({ orders: [], storeName: "", currency: "USD" });
  }

  const orders = await prisma.order.findMany({
    where: {
      storeId: store.id,
      createdAt: { gte: from, lte: to },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      email: o.email,
      financialStatus: o.financialStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      totalPrice: o.totalPrice - o.totalRefunds,
      cogs: o.cogs,
      transactionFees: o.transactionFees,
      grossProfit: o.grossProfit,
      currency: o.currency,
      createdAt: o.createdAt,
    })),
    storeName: store.shopName,
    currency: store.currency,
  });
}
