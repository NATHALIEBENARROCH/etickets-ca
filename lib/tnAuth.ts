// lib/tnAuth.ts
let cachedToken: string | null = null;
let tokenExpiresAt = 0; // epoch ms

export async function getTNAccessToken() {
  const now = Date.now();

  // refresh 2 minutes before expiry
  if (cachedToken && now < tokenExpiresAt - 2 * 60 * 1000) {
    return cachedToken;
  }

  const url = process.env.TN_TOKEN_URL!;
  const key = process.env.TN_CONSUMER_KEY!;
  const secret = process.env.TN_CONSUMER_SECRET!;

  const basic = Buffer.from(`${key}:${secret}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TN token error ${res.status}: ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;

  // souvent expires_in = 3600
  const expiresInSec = Number(data.expires_in ?? 3600);
  tokenExpiresAt = now + expiresInSec * 1000;

  return cachedToken!;
}
