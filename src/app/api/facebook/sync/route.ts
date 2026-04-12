import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFacebookAdSpend } from "@/lib/facebook";
import { format, subDays, eachDayOfInterval } from "date-fns";

const RATES: Record<string, number> = {
  VND: parseFloat(process.env.VND_USD_RATE || "26329.86"),
};

function toUSD(amount: number, currency: string): number {
  const rate = RATES[currency.toUpperCase()];
  return rate ? Math.round((amount / rate) * 100) / 100 : amount;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = await prisma.store.findFirst({
    where: { userId: session.user.id },
    include: { adAccounts: { where: { platform: "facebook", isActive: true } } },
  });

  if (!store || store.adAccounts.length === 0) {
    return NextResponse.json({ success: true, message: "No Facebook accounts" });
  }

  const dateFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  let totalRecords = 0;

  for (const account of store.adAccounts) {
    if (!account.accessToken) continue;

    try {
      const insights = await getFacebookAdSpend(
        account.accountId,
        account.accessToken,
        dateFrom,
        dateTo
      );

      for (const insight of insights) {
        const purchases = (insight.actions || []).find((a: any) => a.action_type === "purchase");
        const purchaseValue = (insight.action_values || []).find((a: any) => a.action_type === "purchase");

        const dateStr = insight.date_start;
        const campaignId = insight.campaign_id || "unknown";

        await prisma.adSpend.upsert({
          where: {
            adAccountId_date_campaignId: {
              adAccountId: account.id,
              date: new Date(dateStr + "T00:00:00.000Z"),
              campaignId,
            },
          },
          create: {
            adAccountId: account.id,
            date: new Date(dateStr + "T00:00:00.000Z"),
            campaignId,
            campaignName: insight.campaign_name,
            spend: toUSD(parseFloat(insight.spend || 0), account.currency),
            impressions: parseInt(insight.impressions || 0),
            clicks: parseInt(insight.clicks || 0),
            purchases: parseInt(purchases?.value || 0),
            revenue: toUSD(parseFloat(purchaseValue?.value || 0), account.currency),
            currency: "USD",
          },
          update: {
            campaignName: insight.campaign_name,
            spend: toUSD(parseFloat(insight.spend || 0), account.currency),
            impressions: parseInt(insight.impressions || 0),
            clicks: parseInt(insight.clicks || 0),
            purchases: parseInt(purchases?.value || 0),
            revenue: toUSD(parseFloat(purchaseValue?.value || 0), account.currency),
          },
        });

        totalRecords++;
      }
    } catch (error) {
      console.error(`Facebook sync error for account ${account.accountId}:`, error);
    }
  }

  return NextResponse.json({ success: true, recordsSync: totalRecords });
}
