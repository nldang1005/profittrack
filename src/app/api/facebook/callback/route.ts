import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { exchangeFacebookCode, getLongLivedToken, getFacebookAdAccounts } from "@/lib/facebook";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?error=facebook_denied", request.url));
  }

  try {
    const appId = process.env.FACEBOOK_APP_ID!;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/facebook/callback`;

    // Exchange code for short-lived token
    const { accessToken: shortToken } = await exchangeFacebookCode(code, appId, appSecret, redirectUri);

    // Get long-lived token (60 days)
    const longToken = await getLongLivedToken(shortToken, appId, appSecret);
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    // Get user's store
    const store = await prisma.store.findFirst({
      where: { userId: session.user.id },
    });

    if (!store) {
      return NextResponse.redirect(new URL("/settings?error=no_store", request.url));
    }

    // Fetch ad accounts
    const adAccounts = await getFacebookAdAccounts(longToken);

    // Save each ad account
    for (const account of adAccounts) {
      if (account.account_status !== 1) continue; // Only active accounts

      const accountId = account.id.replace("act_", "");
      await prisma.adAccount.upsert({
        where: {
          storeId_platform_accountId: {
            storeId: store.id,
            platform: "facebook",
            accountId,
          },
        },
        create: {
          storeId: store.id,
          platform: "facebook",
          accountId,
          accountName: account.name,
          accessToken: longToken,
          tokenExpiresAt: expiresAt,
          currency: account.currency || "USD",
          isActive: true,
        },
        update: {
          accountName: account.name,
          accessToken: longToken,
          tokenExpiresAt: expiresAt,
          isActive: true,
        },
      });
    }

    return NextResponse.redirect(new URL("/settings?connected=facebook", request.url));
  } catch (error) {
    console.error("Facebook callback error:", error);
    return NextResponse.redirect(new URL("/settings?error=facebook_auth_failed", request.url));
  }
}
