import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await prisma.store.findFirst({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ expenses: [] });

  const expenses = await prisma.expense.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ expenses });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await prisma.store.findFirst({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ error: "No store" }, { status: 400 });

  const { name, amount, frequency, category, startDate } = await request.json();

  const expense = await prisma.expense.create({
    data: {
      storeId: store.id,
      name,
      amount,
      frequency: frequency || "monthly",
      category: category || "custom",
      startDate: new Date(startDate),
    },
  });

  return NextResponse.json({ expense });
}
