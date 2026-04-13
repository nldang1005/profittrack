import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await prisma.store.findFirst({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ quotations: [] });

  const quotations = await prisma.productQuotation.findMany({
    where: { storeId: store.id },
    orderBy: [{ country: "asc" }, { keyword: "asc" }],
  });

  return NextResponse.json({ quotations });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await prisma.store.findFirst({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ error: "No store" }, { status: 400 });

  const body = await request.json();
  const { remark, keyword, country, productFee, shippingFee, totalPrice } = body;

  if (!remark || !keyword || !country || totalPrice == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const quotation = await prisma.productQuotation.upsert({
    where: { storeId_keyword_country: { storeId: store.id, keyword: keyword.trim(), country: country.trim().toUpperCase() } },
    create: {
      storeId: store.id,
      remark: remark.trim(),
      keyword: keyword.trim(),
      country: country.trim().toUpperCase(),
      productFee: parseFloat(productFee) || 0,
      shippingFee: parseFloat(shippingFee) || 0,
      totalPrice: parseFloat(totalPrice),
    },
    update: {
      remark: remark.trim(),
      productFee: parseFloat(productFee) || 0,
      shippingFee: parseFloat(shippingFee) || 0,
      totalPrice: parseFloat(totalPrice),
    },
  });

  return NextResponse.json({ quotation });
}
