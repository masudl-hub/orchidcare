// Edge function for deleting a conversation message and regenerating affected summaries.
//
// POST /delete-message
// Auth: Supabase JWT (Bearer token)
// Body: { message_id: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

    // ── Auth: verify JWT and resolve profile_id ──────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");

    // Use service-role client for all DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT to get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return json({ error: "Invalid or expired token" }, 401);
    }

    // Resolve profile_id from user_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return json({ error: "Profile not found" }, 404);
    }

    const profileId = profile.id;

    // ── Input validation ─────────────────────────────────────────────
    const body = await req.json();
    const { message_id: messageId } = body;

    if (!messageId || typeof messageId !== "string") {
      return json({ error: "message_id is required and must be a string" }, 400);
    }

    // ── Verify ownership ─────────────────────────────────────────────
    const { data: message, error: msgError } = await supabase
      .from("conversations")
      .select("id, profile_id")
      .eq("id", messageId)
      .single();

    if (msgError || !message) {
      return json({ error: "Message not found" }, 404);
    }

    if (message.profile_id !== profileId) {
      return json({ error: "Forbidden: message belongs to another user" }, 403);
    }

    // ── Find affected summaries ──────────────────────────────────────
    // source_message_ids is a UUID[] column; use the `cs` (contains) filter
    const { data: affectedSummaries, error: summaryError } = await supabase
      .from("conversation_summaries")
      .select("id, summary, key_topics, source_message_ids, message_count, start_time, end_time")
      .filter("source_message_ids", "cs", `{${messageId}}`);

    if (summaryError) {
      console.error("[DeleteMessage] Error querying summaries:", summaryError);
      return json({ error: "Failed to query affected summaries" }, 500);
    }

    // ── Regenerate each affected summary ─────────────────────────────
    let summariesRegenerated = 0;

    for (const summary of affectedSummaries || []) {
      const remainingIds = (summary.source_message_ids as string[]).filter(
        (id: string) => id !== messageId,
      );

      if (remainingIds.length === 0) {
        // No remaining messages — delete the summary row entirely
        const { error: delSumError } = await supabase
          .from("conversation_summaries")
          .delete()
          .eq("id", summary.id);

        if (delSumError) {
          console.error(`[DeleteMessage] Failed to delete empty summary ${summary.id}:`, delSumError);
        } else {
          summariesRegenerated++;
          console.log(`[DeleteMessage] Deleted empty summary ${summary.id}`);
        }
        continue;
      }

      // Fetch the remaining messages
      const { data: remainingMessages, error: fetchError } = await supabase
        .from("conversations")
        .select("id, direction, content, created_at")
        .in("id", remainingIds)
        .order("created_at", { ascending: true });

      if (fetchError || !remainingMessages?.length) {
        console.error(`[DeleteMessage] Failed to fetch remaining messages for summary ${summary.id}:`, fetchError);
        // If we can't fetch remaining messages, delete the summary as a safety measure
        await supabase.from("conversation_summaries").delete().eq("id", summary.id);
        summariesRegenerated++;
        continue;
      }

      // Build conversation text for the LLM
      const messagesText = remainingMessages
        .map((m: any) => `[${m.direction}]: ${m.content}`)
        .join("\n");

      // Call the Lovable AI gateway to regenerate the summary
      const summaryResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            thinking_config: { thinking_level: "low" },
            messages: [
              {
                role: "system",
                content: `You are a conversation summarizer. Create a concise summary of this plant care conversation that captures:
1. Key plants discussed
2. Issues diagnosed or questions answered
3. Actions taken (plants saved, reminders set)
4. Important user preferences revealed

Return JSON: {"summary": "2-3 sentence summary", "key_topics": ["topic1", "topic2"]}`,
              },
              { role: "user", content: messagesText },
            ],
            max_tokens: 200,
          }),
        },
      );

      if (!summaryResponse.ok) {
        console.error(
          `[DeleteMessage] Summary regeneration failed for ${summary.id}:`,
          await summaryResponse.text(),
        );
        // Fall back: just update the source_message_ids and message_count without changing the summary text
        await supabase
          .from("conversation_summaries")
          .update({
            source_message_ids: remainingIds,
            message_count: remainingIds.length,
          })
          .eq("id", summary.id);
        summariesRegenerated++;
        continue;
      }

      const summaryData = await summaryResponse.json();
      const summaryContent =
        summaryData.choices[0]?.message?.content || "";

      let summaryJson: { summary: string; key_topics: string[] };
      try {
        const jsonMatch = summaryContent.match(/\{[\s\S]*\}/);
        summaryJson = JSON.parse(jsonMatch ? jsonMatch[0] : summaryContent);
      } catch {
        summaryJson = { summary: summaryContent, key_topics: [] };
      }

      // Update the summary row
      const { error: updateError } = await supabase
        .from("conversation_summaries")
        .update({
          summary: summaryJson.summary,
          key_topics: summaryJson.key_topics,
          source_message_ids: remainingIds,
          message_count: remainingIds.length,
          start_time: remainingMessages[0].created_at,
          end_time: remainingMessages[remainingMessages.length - 1].created_at,
        })
        .eq("id", summary.id);

      if (updateError) {
        console.error(`[DeleteMessage] Failed to update summary ${summary.id}:`, updateError);
      } else {
        console.log(
          `[DeleteMessage] Regenerated summary ${summary.id} (${remainingIds.length} messages remaining)`,
        );
      }

      summariesRegenerated++;
    }

    // ── Delete the message ───────────────────────────────────────────
    // ON DELETE SET NULL cascades handle foreign key references (e.g., artifacts)
    const { error: deleteError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", messageId);

    if (deleteError) {
      console.error("[DeleteMessage] Failed to delete message:", deleteError);
      return json({ error: "Failed to delete message" }, 500);
    }

    console.log(
      `[DeleteMessage] Deleted message ${messageId} for profile ${profileId}, regenerated ${summariesRegenerated} summary(ies)`,
    );

    return json({
      success: true,
      summaries_regenerated: summariesRegenerated,
    });
  } catch (error) {
    console.error("[DeleteMessage] Unhandled error:", error);
    return json(
      { error: "Internal server error", details: String(error) },
      500,
    );
  }
});
