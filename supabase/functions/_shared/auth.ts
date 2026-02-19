// Telegram initData HMAC-SHA256 validation
// Per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export async function validateInitData(
  initData: string,
  botToken: string,
): Promise<TelegramUser | null> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    params.delete("hash");

    // Build data-check-string: sorted key=value pairs joined by \n
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    // HMAC chain: secret_key = HMAC-SHA256("WebAppData", botToken)
    const encoder = new TextEncoder();
    const secretKeyData = await crypto.subtle.importKey(
      "raw",
      encoder.encode("WebAppData"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const secretKey = await crypto.subtle.sign("HMAC", secretKeyData, encoder.encode(botToken));

    // computed_hash = HMAC-SHA256(secret_key, data_check_string)
    const computedKeyData = await crypto.subtle.importKey(
      "raw",
      secretKey,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const computedHash = await crypto.subtle.sign("HMAC", computedKeyData, encoder.encode(dataCheckString));

    // Compare hex strings
    const computedHex = Array.from(new Uint8Array(computedHash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (computedHex !== hash) {
      console.error("[Auth] initData HMAC validation failed");
      return null;
    }

    // Check auth_date is not too old (allow 24 hours)
    const authDate = params.get("auth_date");
    if (authDate) {
      const authTimestamp = parseInt(authDate) * 1000;
      const now = Date.now();
      if (now - authTimestamp > 24 * 60 * 60 * 1000) {
        console.error("[Auth] initData is too old");
        return null;
      }
    }

    // Extract user data
    const userStr = params.get("user");
    if (!userStr) return null;

    const user: TelegramUser = JSON.parse(userStr);
    return user;
  } catch (error) {
    console.error("[Auth] initData validation error:", error);
    return null;
  }
}
