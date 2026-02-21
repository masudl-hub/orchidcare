import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// SHA-256 HASHING (matches the frontend key generation)
// ============================================================================
async function hashApiKey(plainKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const startTime = Date.now();

    try {
        // ========================================================================
        // 1. AUTHENTICATE THE DEVELOPER API KEY
        // ========================================================================
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response(
                JSON.stringify({ error: "Missing or invalid Authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const apiKey = authHeader.replace("Bearer ", "");

        // Validate key format (must start with orch_)
        if (!apiKey.startsWith("orch_")) {
            return new Response(
                JSON.stringify({ error: "Invalid API key format" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Hash the incoming key and look it up
        const keyHash = await hashApiKey(apiKey);

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: keyRecord, error: authError } = await supabase
            .from("developer_api_keys")
            .select("id, profile_id, status, rate_limit_per_minute")
            .eq("key_hash", keyHash)
            .eq("status", "active")
            .single();

        if (authError || !keyRecord) {
            console.warn(`[REST API] Invalid or revoked API key attempt`);
            return new Response(
                JSON.stringify({ error: "Invalid or revoked API key" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ========================================================================
        // 2. RATE LIMITING
        // ========================================================================
        const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
        const { count: recentCalls } = await supabase
            .from("api_usage_log")
            .select("*", { count: "exact", head: true })
            .eq("api_key_id", keyRecord.id)
            .gte("created_at", oneMinuteAgo);

        const limit = keyRecord.rate_limit_per_minute || 7;
        if ((recentCalls ?? 0) >= limit) {
            console.warn(`[REST API] Rate limit exceeded for key ${keyRecord.id}: ${recentCalls}/${limit}`);
            return new Response(
                JSON.stringify({
                    error: "Rate limit exceeded",
                    limit_per_minute: limit,
                    retry_after_seconds: 60,
                }),
                {
                    status: 429,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                        "Retry-After": "60",
                    },
                }
            );
        }

        // ========================================================================
        // 3. PARSE REQUEST
        // ========================================================================
        const body = await req.json();
        const { message, end_user_id, media = [] } = body;

        if (!message || !end_user_id) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: message, end_user_id" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[REST API] Developer ${keyRecord.profile_id} → user ${end_user_id}`);

        // ========================================================================
        // 4. FORWARD TO ORCHID-AGENT
        // ========================================================================
        const functionUrl = `${supabaseUrl}/functions/v1/orchid-agent`;

        const agentResponse = await fetch(functionUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                Body: message,
                From: `api_${keyRecord.profile_id}_${end_user_id}`,
                MediaUrl0: media[0] || "",
                isInternalAgentCall: true,
                developer_origin: keyRecord.profile_id,
            }),
        });

        const latencyMs = Date.now() - startTime;

        if (!agentResponse.ok) {
            const errorText = await agentResponse.text();
            console.error(`[REST API] orchid-agent failed: ${agentResponse.status}`);

            // Log the error
            await supabase.from("api_usage_log").insert({
                api_key_id: keyRecord.id,
                profile_id: keyRecord.profile_id,
                end_user_id,
                status: "error",
                error_message: `Agent returned ${agentResponse.status}`,
                latency_ms: latencyMs,
            });

            return new Response(
                JSON.stringify({ error: "Agent processing failed", details: errorText }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ========================================================================
        // 5. LOG SUCCESS + RETURN RESPONSE
        // ========================================================================
        const agentData = await agentResponse.json();

        // Log the successful call and increment total_calls (fire and forget)
        supabase
            .from("api_usage_log")
            .insert({
                api_key_id: keyRecord.id,
                profile_id: keyRecord.profile_id,
                end_user_id,
                status: "success",
                latency_ms: latencyMs,
            })
            .then();

        supabase
            .from("developer_api_keys")
            .update({
                total_calls: (keyRecord as any).total_calls + 1,
                last_used_at: new Date().toISOString(),
            })
            .eq("id", keyRecord.id)
            .then();

        return new Response(
            JSON.stringify({
                success: true,
                data: agentData,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[REST API] Unhandled error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error", details: String(error) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
