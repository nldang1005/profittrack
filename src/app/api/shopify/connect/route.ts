import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { buildShopifyOAuthUrl } from "@/lib/shopify";
import crypto from "crypto";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop");

  if (!shop) {
    return NextResponse.json({ error: "shop parameter required" }, { status: 400 });
  }

  // Normalize shop domain
  const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;

  const apiKey = process.env.SHOPIFY_API_KEY!;
  const scopes = process.env.SHOPIFY_SCOPES!;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/shopify/callback`;

  // Generate state with user ID for security
  const state = crypto
    .createHmac("sha256", process.env.NEXTAUTH_SECRET!)
    .update(`${session.user.id}:${Date.now()}`)
    .digest("hex")
    .slice(0, 16);

  const authUrl = buildShopifyOAuthUrl(shopDomain, apiKey, scopes, redirectUri, state);

  return NextResponse.redirect(authUrl);
}
