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
    include: {
      adAccounts: {
        select: {
          id: true,
          platform: true,
          accountName: true,
          accountId: true,
          isActive: true,
          tokenExpiresAt: true,
        },
      },
    },
  });

  return NextResponse.json({ store });
}
