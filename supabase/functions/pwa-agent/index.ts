import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ---------------------------------------------------------------------------
    // 1. Authenticate: validate JWT from Authorization header
    // ---------------------------------------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("[pwa-agent] JWT validation failed:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // ---------------------------------------------------------------------------
    // 2. Look up profile by user_id
    // ---------------------------------------------------------------------------
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("[pwa-agent] Profile lookup error:", profileError);
      return new Response(JSON.stringify({ error: "Profile lookup failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile) {
      return new Response(JSON.stringify({ error: "no_profile" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------------------------------------------------------------------------
    // 3. Parse request body
    // ---------------------------------------------------------------------------
    const body = await req.json();
    const { message, mediaBase64, mediaMimeType } = body as {
      message: string;
      mediaBase64?: string;
      mediaMimeType?: string;
    };

    if (!message && !mediaBase64) {
      return new Response(JSON.stringify({ error: "Message or media required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------------------------------------------------------------------------
    // 4. Forward to orchid-agent as internal call
    // ---------------------------------------------------------------------------
    const orchidAgentUrl = `${SUPABASE_URL}/functions/v1/orchid-agent`;

    const payload: Record<string, unknown> = {
      profileId: profile.id,
      message: message || "(photo)",
      channel: "pwa",
    };

    if (mediaBase64 && mediaMimeType) {
      payload.mediaBase64 = mediaBase64;
      payload.mediaMimeType = mediaMimeType;
    }

    console.log(`[pwa-agent] Forwarding to orchid-agent for profile ${profile.id}, msg length: ${(message || "").length}, hasMedia: ${!!mediaBase64}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150000);

    const agentResponse = await fetch(orchidAgentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "X-Internal-Agent-Call": "true",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error(`[pwa-agent] orchid-agent error: ${agentResponse.status} ${errorText.substring(0, 500)}`);
      return new Response(JSON.stringify({ error: "Agent error", detail: errorText.substring(0, 200) }), {
        status: agentResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------------------------------------------------------------------------
    // 5. Stream NDJSON back to the client
    //    orchid-agent returns { reply, mediaToSend } as JSON.
    //    We wrap it in an NDJSON stream so the client can show tool status events
    //    (for now, just a single "done" event — future: pipe tool events through).
    // ---------------------------------------------------------------------------
    const agentResult = await agentResponse.json();

    // Build NDJSON response with real tool events
    const events: string[] = [];

    // Emit tool events from actual tool usage
    if (agentResult.toolsUsed && Array.isArray(agentResult.toolsUsed)) {
      for (const toolName of agentResult.toolsUsed) {
        events.push(JSON.stringify({ event: "tool", name: toolName }));
      }
    }

    events.push(
      JSON.stringify({
        event: "done",
        data: {
          reply: agentResult.reply || "",
          mediaToSend: agentResult.mediaToSend || [],
        },
      })
    );

    const ndjson = events.join("\n") + "\n";

    return new Response(ndjson, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/x-ndjson",
      },
    });
  } catch (error) {
    console.error("[pwa-agent] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
