// Shopify Admin API helper

export const SHOPIFY_API_VERSION = "2024-01";

export function getShopifyHeaders(accessToken: string) {
  return {
    "X-Shopify-Access-Token": accessToken,
    "Content-Type": "application/json",
  };
}

export function shopifyUrl(shopDomain: string, path: string) {
  return `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}${path}`;
}

// Fetch all pages of a Shopify resource
export async function shopifyFetchAll<T>(
  shopDomain: string,
  accessToken: string,
  endpoint: string,
  resourceKey: string
): Promise<T[]> {
  const results: T[] = [];
  let url: string | null = shopifyUrl(shopDomain, endpoint);

  while (url) {
    const response: Response = await fetch(url, {
      headers: getShopifyHeaders(accessToken),
    });

    if (!response.ok) {
      const text: string = await response.text();
      throw new Error(`Shopify API error ${response.status}: ${text}`);
    }

    const data: Record<string, unknown> = await response.json();
    results.push(...((data[resourceKey] as T[]) || []));

    // Parse Link header for next page
    const linkHeader: string | null = response.headers.get("Link");
    url = null;
    if (linkHeader) {
      const nextMatch: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) url = nextMatch[1];
    }
  }

  return results;
}

// Calculate Shopify transaction fee (usually 2% for basic plan)
export function calculateTransactionFee(
  totalPrice: number,
  gateway: string
): number {
  // Shopify Payments: 0%, Basic plan: 2%, Shopify plan: 1%, Advanced: 0.5%
  // We'll use a default of 2% + $0.30 for external gateways
  if (gateway === "shopify_payments") return 0;
  return totalPrice * 0.02 + 0.3;
}

export function buildShopifyOAuthUrl(
  shopDomain: string,
  apiKey: string,
  scopes: string,
  redirectUri: string,
  state: string
) {
  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${shopDomain}/admin/oauth/authorize?${params}`;
}

export async function exchangeShopifyCode(
  shopDomain: string,
  code: string,
  apiKey: string,
  apiSecret: string
): Promise<string> {
  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  });

  if (!res.ok) throw new Error("Failed to exchange Shopify OAuth code");
  const data = await res.json();
  return data.access_token;
}
