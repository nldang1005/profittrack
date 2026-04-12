import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { buildFacebookOAuthUrl } from "@/lib/facebook";
import crypto from "crypto";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appId = process.env.FACEBOOK_APP_ID!;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/facebook/callback`;

  const state = crypto
    .createHmac("sha256", process.env.NEXTAUTH_SECRET!)
    .update(`fb:${session.user.id}:${Date.now()}`)
    .digest("hex")
    .slice(0, 16);

  const authUrl = buildFacebookOAuthUrl(appId, redirectUri, state);
  return NextResponse.redirect(authUrl);
}
