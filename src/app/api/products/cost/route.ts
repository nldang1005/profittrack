import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { variantId, cost } = await request.json();

  if (!variantId || cost === undefined) {
    return NextResponse.json({ error: "variantId and cost required" }, { status: 400 });
  }

  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: { cost: parseFloat(cost) || 0 },
  });

  // Re-calculate COGS for orders containing this variant (match by Shopify variant ID)
  const lineItems = await prisma.lineItem.findMany({
    where: { variantId: variant.shopifyVariantId },
    include: { order: true },
  });

  for (const item of lineItems) {
    await prisma.lineItem.update({
      where: { id: item.id },
      data: { cost: parseFloat(cost) || 0 },
    });
  }

  // Recalculate order COGS
  const orderIds = [...new Set(lineItems.map((i) => i.orderId))];
  for (const orderId of orderIds) {
    const items = await prisma.lineItem.findMany({ where: { orderId } });
    const totalCogs = items.reduce((s, i) => s + i.cost * i.quantity, 0);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (order) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          cogs: totalCogs,
          grossProfit: order.totalPrice - order.totalRefunds - totalCogs - order.transactionFees,
        },
      });
    }
  }

  return NextResponse.json({ success: true });
}
