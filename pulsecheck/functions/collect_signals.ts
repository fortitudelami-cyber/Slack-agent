type SlackEvent = Record<string, unknown>;
type SlackClient = Record<string, unknown>;
type Logger = { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

type DailySignalRecord = {
  channelId: string;
  date: string;
  messageVolume: number;
  afterHoursCount: number;
  crossChannelMentions: number;
  threadLatencySumMs: number;
  threadLatencyCount: number;
  reactionCounts: Record<string, number>;
  updatedAt: number;
};

type ThreadRecord = {
  channelId: string;
  threadTs: string;
  rootTs: string;
  firstReplyLatencyMs?: number;
  createdAt: number;
};

const DATASTORE_NAME = "pulsecheck_signals";

function normalizeDate(value: number, offsetSeconds = 0): string {
  const date = new Date(value * 1000 + offsetSeconds * 1000);
  return date.toISOString().slice(0, 10);
}

function isAfterHours(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 20 || hour < 7;
}

function extractChannelMentions(text?: string): Array<string> {
  if (!text || typeof text !== "string") return [];
  const matches = text.matchAll(/<#(C[0-9A-Z]+)(\|[^>]+)?>/g);
  return Array.from(matches, (m) => m[1]);
}

async function getDatastoreValue(key: string, client: SlackClient): Promise<any> {
  try {
    const request = (client as any).datastore?.get;
    if (typeof request !== "function") return null;
    return await request({ datastore: DATASTORE_NAME, key });
  } catch (_error) {
    return null;
  }
}

async function putDatastoreValue(key: string, value: unknown, client: SlackClient): Promise<void> {
  const request = (client as any).datastore?.put;
  if (typeof request !== "function") {
    throw new Error("Datastore client not available");
  }

  await request({ datastore: DATASTORE_NAME, key, value });
}

function getThreadKey(threadTs: string): string {
  return `pulsecheck:thread:${threadTs}`;
}

function getDailyKey(channelId: string, date: string): string {
  return `pulsecheck:daily:${channelId}:${date}`;
}

function getWeeklyKey(channelId: string, weekStart: string): string {
  return `pulsecheck:weekly:${channelId}:${weekStart}`;
}

function computeWeekStart(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const mondayOffset = ((dayOfWeek + 6) % 7);
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

async function updateDailyRecord(channelId: string, date: string, changes: Partial<DailySignalRecord>, client: SlackClient): Promise<void> {
  const key = getDailyKey(channelId, date);
  const existing = (await getDatastoreValue(key, client)) as DailySignalRecord | null;
  const now = Date.now();
  const updated: DailySignalRecord = {
    channelId,
    date,
    messageVolume: 0,
    afterHoursCount: 0,
    crossChannelMentions: 0,
    threadLatencySumMs: 0,
    threadLatencyCount: 0,
    reactionCounts: {},
    updatedAt: now,
    ...(existing ?? {}),
    ...changes,
    updatedAt: now
  };

  if (existing) {
    updated.reactionCounts = { ...existing.reactionCounts, ...updated.reactionCounts };
  }

  await putDatastoreValue(key, updated, client);
}

async function updateWeeklyReactionCounts(channelId: string, weekStart: string, emoji: string, client: SlackClient): Promise<void> {
  const key = getWeeklyKey(channelId, weekStart);
  const existing = (await getDatastoreValue(key, client)) as { reactionCounts?: Record<string, number>; updatedAt?: number } | null;
  const reactionCounts = { ...(existing?.reactionCounts ?? {}) };
  reactionCounts[emoji] = (reactionCounts[emoji] ?? 0) + 1;

  await putDatastoreValue(key, { channelId, weekStart, reactionCounts, updatedAt: Date.now() }, client);
}

export async function collectSignals({ event, client, logger }: {
  event: SlackEvent;
  client: SlackClient;
  logger: Logger;
}): Promise<void> {
  try {
    const type = event.type as string | undefined;
    if (type === "reaction_added") {
      const channel = event.item?.channel as string | undefined;
      const reaction = event.reaction as string | undefined;
      const ts = Number(event.event_ts || event.ts || 0);
      if (!channel || !reaction || !ts) return;

      const date = normalizeDate(ts, Number(event.tz_offset ?? 0));
      const weekStart = computeWeekStart(date);
      await updateWeeklyReactionCounts(channel, weekStart, reaction, client);
      logger.info(`PulseCheck: recorded reaction ${reaction} for ${channel} on ${date}`);
      return;
    }

    if (type !== "message") {
      return;
    }

    const subtype = event.subtype as string | undefined;
    if (subtype && subtype !== "thread_broadcast") {
      return;
    }

    const channel = event.channel as string | undefined;
    const tsValue = Number(event.ts || 0);
    if (!channel || !tsValue) {
      logger.warn("PulseCheck: message event missing channel or ts");
      return;
    }

    const tzOffsetSeconds = Number(event.tz_offset ?? 0);
    const date = normalizeDate(tsValue, tzOffsetSeconds);
    const weekStart = computeWeekStart(date);
    const timeValue = new Date(tsValue * 1000 + tzOffsetSeconds * 1000);
    const afterHoursIncrement = isAfterHours(timeValue) ? 1 : 0;
    const mentionTargets = extractChannelMentions(event.text as string | undefined).filter((id) => id !== channel);
    const mentionIncrement = mentionTargets.length;

    await updateDailyRecord(channel, date, {
      messageVolume: 1,
      afterHoursCount: afterHoursIncrement,
      crossChannelMentions: mentionIncrement
    }, client);

    if (event.thread_ts && event.thread_ts !== event.ts) {
      const threadKey = getThreadKey(event.thread_ts as string);
      const rootRecord = await getDatastoreValue(threadKey, client) as ThreadRecord | null;
      const currentReplyTs = tsValue * 1000;
      if (rootRecord?.firstReplyLatencyMs == null) {
        const rootTsValue = Number(event.thread_ts) * 1000;
        if (rootTsValue > 0) {
          const latencyMs = Math.max(0, currentReplyTs - rootTsValue);
          await updateDailyRecord(channel, date, {
            threadLatencySumMs: latencyMs,
            threadLatencyCount: 1
          }, client);
          await putDatastoreValue(threadKey, {
            channelId: channel,
            threadTs: event.thread_ts,
            rootTs: event.thread_ts,
            firstReplyLatencyMs: latencyMs,
            createdAt: Date.now()
          }, client);
        }
      }
    } else if (event.thread_ts && event.thread_ts === event.ts) {
      const threadKey = getThreadKey(event.thread_ts as string);
      await putDatastoreValue(threadKey, {
        channelId: channel,
        threadTs: event.thread_ts,
        rootTs: event.thread_ts,
        createdAt: Date.now()
      }, client);
    }

    logger.info(`PulseCheck: recorded metadata signal for channel ${channel} on ${date}`);
  } catch (error) {
    logger.error("PulseCheck: collectSignals failed", error);
    throw error;
  }
}
