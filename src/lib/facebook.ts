// Facebook Marketing API helper

export const FB_API_VERSION = "v19.0";
export const FB_BASE = `https://graph.facebook.com/${FB_API_VERSION}`;

export function fbUrl(path: string) {
  return `${FB_BASE}${path}`;
}

export function buildFacebookOAuthUrl(
  appId: string,
  redirectUri: string,
  state: string
) {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: "ads_read,ads_management,business_management",
    response_type: "code",
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

export async function exchangeFacebookCode(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${FB_BASE}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error("Failed to exchange Facebook OAuth code");

  const data = await res.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function getLongLivedToken(
  shortToken: string,
  appId: string,
  appSecret: string
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });

  const res = await fetch(`${FB_BASE}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error("Failed to get long-lived token");

  const data = await res.json();
  return data.access_token;
}

export async function getFacebookAdAccounts(accessToken: string) {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,name,currency,account_status",
    limit: "100",
  });

  const res = await fetch(`${FB_BASE}/me/adaccounts?${params}`);
  if (!res.ok) throw new Error("Failed to fetch Facebook ad accounts");

  const data = await res.json();
  return data.data || [];
}

export async function getFacebookAdSpend(
  adAccountId: string,
  accessToken: string,
  dateFrom: string,
  dateTo: string
) {
  const params = new URLSearchParams({
    access_token: accessToken,
    level: "campaign",
    fields: "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values",
    time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
    time_increment: "1",
    limit: "500",
  });

  const results: any[] = [];
  let url: string | null = `${FB_BASE}/act_${adAccountId}/insights?${params}`;

  while (url) {
    const response: Response = await fetch(url);
    if (!response.ok) {
      const err: { error?: { message: string } } = await response.json();
      throw new Error(`Facebook API error: ${err.error?.message}`);
    }

    const data: { data: any[]; paging?: { next?: string } } = await response.json();
    results.push(...(data.data || []));

    url = data.paging?.next || null;
  }

  return results;
}
