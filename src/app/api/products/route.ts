import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await prisma.store.findFirst({
    where: { userId: session.user.id },
  });

  if (!store) return NextResponse.json({ products: [] });

  const products = await prisma.product.findMany({
    where: { storeId: store.id, status: "active" },
    include: {
      variants: {
        select: {
          id: true,
          title: true,
          sku: true,
          cost: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      productId: p.shopifyProductId,
      title: p.title,
      variants: p.variants,
    })),
  });
}
