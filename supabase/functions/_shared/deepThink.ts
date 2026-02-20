// Shared deep_think implementation — routes complex questions to a smarter model.
// Used by call-session, dev-call-proxy, and demo-agent.

export async function callDeepThink(
  question: string,
  context: string | undefined,
  LOVABLE_API_KEY: string,
): Promise<Record<string, unknown>> {
  const startTime = Date.now();
  console.log(`[DeepThink] Question: ${question.substring(0, 200)}`);

  try {
    const prompt = context
      ? `${question}\n\nAdditional context: ${context}`
      : question;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert botanist and plant pathologist. You reason carefully and thoroughly about plant care questions. Provide detailed, actionable advice. Be specific about symptoms, causes, and treatments. If multiple possibilities exist, list them in order of likelihood.

Keep your response concise but thorough — this will be spoken aloud in a voice call. Aim for 3-5 sentences of clear, practical advice.`,
          },
          { role: "user", content: prompt },
        ],
        temperature: 1.0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[DeepThink] API error: ${response.status}`, errText);
      return { success: false, error: `Deep think failed: ${response.status}` };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "";
    const elapsed = Date.now() - startTime;
    console.log(`[DeepThink] Complete in ${elapsed}ms, ${answer.length} chars`);

    return { success: true, answer, model: "gemini-3-flash", latencyMs: elapsed };
  } catch (error) {
    console.error("[DeepThink] Error:", error);
    return { success: false, error: String(error) };
  }
}
