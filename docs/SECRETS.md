# Orchid Secrets Checklist

> **Last Updated:** 2026-02-19

Secrets required for a new Orchid deployment. The 5 `SUPABASE_*` secrets are auto-configured when Lovable Cloud is enabled.

## Manual Secrets (8)

| Secret | Purpose | Where to Get It |
|--------|---------|-----------------|
| `GEMINI_API_KEY` | Google Gemini AI model access | [Google AI Studio](https://aistudio.google.com/apikey) |
| `TWILIO_ACCOUNT_SID` | Twilio account identifier for SMS/WhatsApp | [Twilio Console](https://console.twilio.com/) |
| `TWILIO_AUTH_TOKEN` | Twilio API authentication | Twilio Console → Account Info |
| `TWILIO_PHONE_NUMBER` | Outbound SMS phone number (e.g., `+1234567890`) | Twilio Console → Phone Numbers |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token | [@BotFather](https://t.me/BotFather) on Telegram |
| `PERPLEXITY_API_KEY` | Perplexity AI for web research (managed by connector) | [Perplexity API](https://docs.perplexity.ai/) |
| `DEV_AUTH_SECRET` | Development authentication bypass | Self-generated (any secure random string) |
| `DEMO_HMAC_SECRET` | HMAC signing for demo endpoints | Self-generated (any secure random string) |

## Additional Secrets

| Secret | Purpose | Notes |
|--------|---------|-------|
| `Perplexity_Research` | Perplexity research configuration | May be connector-managed |
| `LOVABLE_API_KEY` | Lovable platform API access | Provided by Lovable |

## Auto-Configured (5)

These are set automatically when Lovable Cloud is enabled. Do **not** set manually.

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Database API endpoint |
| `SUPABASE_ANON_KEY` | Public/anonymous API key |
| `SUPABASE_PUBLISHABLE_KEY` | Client-side publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin key (edge functions only) |
| `SUPABASE_DB_URL` | Direct database connection string |
