// Shared audit logging utilities for outbound message tracking

/**
 * Log an outbound Telegram message to the audit table.
 * Call this from every code path that sends a Telegram message.
 */
export async function logOutboundMessage(
  supabase: any,
  params: {
    sourceFunction: string;
    sourceMode: 'telegram_reply' | 'proactive' | 'media_followup' | 'other';
    profileId: string;
    telegramChatId?: number | bigint | null;
    correlationId?: string | null;
    messagePreview?: string | null;
    telegramMessageId?: number | bigint | null;
    deliveryStatus: 'attempted' | 'delivered' | 'failed' | 'skipped';
    errorCode?: string | null;
    errorDetail?: string | null;
    triggerPayload?: any;
  },
): Promise<void> {
  try {
    const preview = params.messagePreview
      ? params.messagePreview.substring(0, 500)
      : null;

    // Simple hash for dedup detection
    const messageHash = preview
      ? Array.from(new TextEncoder().encode(preview))
          .reduce((h, b) => ((h << 5) - h + b) | 0, 0)
          .toString(16)
      : null;

    await supabase.from('outbound_message_audit').insert([{
      source_function: params.sourceFunction,
      source_mode: params.sourceMode,
      profile_id: params.profileId,
      telegram_chat_id: params.telegramChatId ?? null,
      correlation_id: params.correlationId ?? null,
      message_preview: preview,
      message_hash: messageHash,
      telegram_message_id: params.telegramMessageId ?? null,
      delivery_status: params.deliveryStatus,
      error_code: params.errorCode ?? null,
      error_detail: params.errorDetail ?? null,
      trigger_payload: params.triggerPayload ?? null,
    }]);
  } catch (err) {
    // Audit logging should never break the main flow
    console.error('[Audit] Failed to log outbound message:', err);
  }
}

/**
 * Log a proactive-agent run to the run audit table.
 */
export async function logProactiveRun(
  supabase: any,
  params: {
    runStartedAt: Date;
    runEndedAt: Date;
    triggerSource?: string;
    profilesScanned: number;
    eventsFound: number;
    messagesDelivered: number;
    messagesSkipped: number;
    skipReasons?: Record<string, number>;
    error?: string;
  },
): Promise<void> {
  try {
    await supabase.from('proactive_run_audit').insert([{
      run_started_at: params.runStartedAt.toISOString(),
      run_ended_at: params.runEndedAt.toISOString(),
      trigger_source: params.triggerSource ?? null,
      profiles_scanned: params.profilesScanned,
      events_found: params.eventsFound,
      messages_delivered: params.messagesDelivered,
      messages_skipped: params.messagesSkipped,
      skip_reasons: params.skipReasons ?? null,
      duration_ms: params.runEndedAt.getTime() - params.runStartedAt.getTime(),
      error: params.error ?? null,
    }]);
  } catch (err) {
    console.error('[Audit] Failed to log proactive run:', err);
  }
}

/**
 * Generate a correlation ID for tracing a request across functions.
 */
export function generateCorrelationId(prefix: string = 'corr'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Compute an event fingerprint for deduplication.
 * Returns a string hash of profile + event type + identifiers + day bucket.
 */
export function computeEventFingerprint(
  profileId: string,
  eventType: string,
  identifiers: Record<string, string>,
): string {
  const dayBucket = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const idString = Object.entries(identifiers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('|');
  const raw = `${profileId}:${eventType}:${idString}:${dayBucket}`;
  // Simple hash
  const hash = Array.from(new TextEncoder().encode(raw))
    .reduce((h, b) => ((h << 5) - h + b) | 0, 0);
  return hash.toString(16);
}
