#!/usr/bin/env -S deno run --allow-env --allow-net

/**
 * Seed demo data script: Creates 5 weeks of fake signal data for 3 channels
 * with anomalies in the current week (week 5).
 *
 * Run: deno run --allow-env --allow-net scripts/seed_demo_data.ts
 */

const DATASTORE_NAMESPACE = "pulsecheck_signals";
const CHANNELS = ["C001", "C002", "C003"];
const CHANNEL_NAMES = { C001: "engineering", C002: "sales", C003: "product" };

type DailySignal = {
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

/**
 * Generate date string for a given offset from today (negative = past)
 */
function dateForOffset(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/**
 * Generate a week start date string
 */
function getWeekStart(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

/**
 * Generate baseline signals (weeks 1-4)
 */
function generateBaselineSignal(
  channelId: string,
  dateStr: string,
  channelIndex: number
): DailySignal {
  const baseVolume = 100 + channelIndex * 20;
  const baseLatency = 400 + channelIndex * 50;
  const baseMentions = 5 + channelIndex * 2;
  const baseAfterHours = 3 + channelIndex;

  return {
    channelId,
    date: dateStr,
    messageVolume: baseVolume + Math.random() * 20 - 10,
    afterHoursCount: baseAfterHours + Math.random() * 2,
    crossChannelMentions: baseMentions + Math.random() * 2,
    threadLatencySumMs: (baseLatency + Math.random() * 50) * 5,
    threadLatencyCount: 5,
    reactionCounts: { "+1": 8, "heart": 4, "rocket": 2 },
    updatedAt: Date.now()
  };
}

/**
 * Generate anomaly signals (week 5, current week)
 * - engineering: after-hours spike +80%
 * - sales: response latency up +55%
 * - product: volume drop -40%
 */
function generateAnomalySignal(
  channelId: string,
  dateStr: string,
  channelIndex: number
): DailySignal {
  let messageVolume = 100 + channelIndex * 20;
  let latency = 400 + channelIndex * 50;
  let afterHours = 3 + channelIndex;

  if (channelId === CHANNELS[0]) {
    afterHours *= 1.8;
  }
  if (channelId === CHANNELS[1]) {
    latency *= 1.55;
  }
  if (channelId === CHANNELS[2]) {
    messageVolume *= 0.6;
  }

  return {
    channelId,
    date: dateStr,
    messageVolume: messageVolume + Math.random() * 10 - 5,
    afterHoursCount: afterHours + Math.random() * 1,
    crossChannelMentions: 5 + Math.random() * 2,
    threadLatencySumMs: (latency + Math.random() * 30) * 5,
    threadLatencyCount: 5,
    reactionCounts: { "+1": 6, "heart": 3, "rocket": 1 },
    updatedAt: Date.now()
  };
}

/**
 * Construct a datastore key for daily signals
 */
function getDailyKey(channelId: string, date: string): string {
  return `pulsecheck:daily:${channelId}:${date}`;
}

/**
 * Insert a signal into a mock datastore (prints JSON for manual insertion)
 */
function insertSignal(signal: DailySignal): void {
  const key = getDailyKey(signal.channelId, signal.date);
  const payload = {
    datastore: DATASTORE_NAMESPACE,
    key,
    value: signal
  };
  console.log(JSON.stringify(payload));
}

/**
 * Main: Generate and print seed data
 */
async function seed() {
  console.error("=== PulseCheck Demo Data Seed ===");
  console.error("Generating 5 weeks of signal data for 3 channels...\n");

  for (let weekOffset = 28; weekOffset >= 0; weekOffset -= 7) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dateStr = dateForOffset(weekOffset - dayOffset);
      const isAnomalyWeek = weekOffset < 7;

      for (let i = 0; i < CHANNELS.length; i++) {
        const channelId = CHANNELS[i];
        const signal = isAnomalyWeek
          ? generateAnomalySignal(channelId, dateStr, i)
          : generateBaselineSignal(channelId, dateStr, i);

        insertSignal(signal);
      }
    }
  }

  console.error("\nSeed data printed as JSON lines above.");
  console.error("To use with Slack Datastore, add each line via the Slack CLI or API.");
  console.error("\nChannels seeded:");
  console.error("  - C001 (engineering): after-hours spike in week 5");
  console.error("  - C002 (sales): latency increase in week 5");
  console.error("  - C003 (product): volume drop in week 5");
}

seed().catch((e) => {
  console.error("Seed error:", e);
  Deno.exit(1);
});
