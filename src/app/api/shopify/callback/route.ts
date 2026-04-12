import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { exchangeShopifyCode, shopifyUrl, getShopifyHeaders } from "@/lib/shopify";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop")!;
  const code = searchParams.get("code")!;

  if (!shop || !code) {
    return NextResponse.redirect(new URL("/settings?error=missing_params", request.url));
  }

  try {
    const accessToken = await exchangeShopifyCode(
      shop,
      code,
      process.env.SHOPIFY_API_KEY!,
      process.env.SHOPIFY_API_SECRET!
    );

    // Fetch shop info
    const shopRes = await fetch(shopifyUrl(shop, "/shop.json"), {
      headers: getShopifyHeaders(accessToken),
    });
    const shopData = await shopRes.json();
    const shopInfo = shopData.shop;

    // Upsert store
    await prisma.store.upsert({
      where: { shopDomain: shop },
      create: {
        userId: session.user.id,
        shopDomain: shop,
        shopName: shopInfo.name,
        accessToken,
        currency: shopInfo.currency,
        timezone: shopInfo.iana_timezone || "UTC",
      },
      update: {
        accessToken,
        shopName: shopInfo.name,
        currency: shopInfo.currency,
      },
    });

    return NextResponse.redirect(new URL("/settings?connected=shopify", request.url));
  } catch (error) {
    console.error("Shopify callback error:", error);
    return NextResponse.redirect(new URL("/settings?error=shopify_auth_failed", request.url));
  }
}
