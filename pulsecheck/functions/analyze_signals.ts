type AnalysisResult = {
  channel: string;
  signal_type: string;
  severity: "low" | "medium" | "high";
  summary_text: string;
};

type SlackClient = Record<string, unknown>;
type Logger = { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

type DailySignalRecord = {
  channelId: string;
  date: string;
  messageVolume: number;
  afterHoursCount: number;
  threadLatencySumMs: number;
  threadLatencyCount: number;
};

const DATASTORE_NAME = "pulsecheck_signals";

async function listDailyRecords(client: SlackClient): Promise<DailySignalRecord[]> {
  const listFn = (client as any).datastore?.list;
  if (typeof listFn !== "function") return [];
  const response = await listFn({ datastore: DATASTORE_NAME, prefix: "pulsecheck:daily:" });
  return Array.isArray(response?.items) ? response.items.map((item: any) => item.value) : [];
}

function parseRecordDate(record: DailySignalRecord): number {
  return Date.parse(record.date);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeAggregate(records: DailySignalRecord[]): { volumeAvg: number; latencyAvgMs: number; afterHoursAvg: number } {
  if (!records.length) return { volumeAvg: 0, latencyAvgMs: 0, afterHoursAvg: 0 };
  const volumeAvg = average(records.map((v) => v.messageVolume));
  const latencyAvgMs = average(records.map((v) => (v.threadLatencyCount ? v.threadLatencySumMs / v.threadLatencyCount : 0)));
  const afterHoursAvg = average(records.map((v) => v.afterHoursCount));
  return { volumeAvg, latencyAvgMs, afterHoursAvg };
}

/**
 * Calculate a 0-100 health score based on anomaly penalties and bonuses:
 * - Volume drop penalty: -2 per % drop beyond 20%
 * - Latency penalty: -1.5 per % increase beyond 25%
 * - After-hours penalty: -3 per % increase beyond 30%
 * - Cross-team mention bonus: +1 per % increase up to +10
 * Floor at 0, ceiling at 100
 */
function calculateHealthScore(
  volumeChange: number,
  latencyChange: number,
  afterHoursChange: number,
  mentionChange: number
): number {
  let score = 75;

  const volumeDropPct = Math.max(0, -volumeChange);
  if (volumeDropPct > 20) {
    score -= (volumeDropPct - 20) * 2;
  }

  const latencyIncreasePct = Math.max(0, latencyChange);
  if (latencyIncreasePct > 25) {
    score -= (latencyIncreasePct - 25) * 1.5;
  }

  const afterHoursIncreasePct = Math.max(0, afterHoursChange);
  if (afterHoursIncreasePct > 30) {
    score -= (afterHoursIncreasePct - 30) * 3;
  }

  const mentionIncreasePct = Math.min(10, Math.max(0, mentionChange));
  score += mentionIncreasePct * 1;

  return Math.max(0, Math.min(100, score));
}

function buildPrompt(channel: string, current: { volumeAvg: number; latencyAvgMs: number; afterHoursAvg: number }, baseline: { volumeAvg: number; latencyAvgMs: number; afterHoursAvg: number }): string {
  return `Analyze the following channel health metrics for ${channel} and return a concise anomaly summary.\n\nCurrent 7-day averages:\n- volume: ${current.volumeAvg.toFixed(1)}\n- latency (ms): ${current.latencyAvgMs.toFixed(1)}\n- after-hours: ${current.afterHoursAvg.toFixed(1)}\n\nBaseline 4-week averages:\n- volume: ${baseline.volumeAvg.toFixed(1)}\n- latency (ms): ${baseline.latencyAvgMs.toFixed(1)}\n- after-hours: ${baseline.afterHoursAvg.toFixed(1)}\n\nFlag the most important anomalies and explain the likely impact on channel health.`;
}

async function generateSummary(client: SlackClient, logger: Logger, channel: string, current: { volumeAvg: number; latencyAvgMs: number; afterHoursAvg: number }, baseline: { volumeAvg: number; latencyAvgMs: number; afterHoursAvg: number }): Promise<string> {
  const prompt = buildPrompt(channel, current, baseline);
  const ai = (client as any).ai;

  if (ai?.generate) {
    try {
      const response = await ai.generate({ model: "gpt-4o-mini", prompt });
      if (response?.text) {
        return String(response.text).trim();
      }
    } catch (error) {
      logger.warn("PulseCheck: Slack AI summary generation failed", error);
    }
  }

  const lines = [];
  if (baseline.volumeAvg > 0 && current.volumeAvg < baseline.volumeAvg * 0.7) {
    lines.push("Volume is down significantly compared to baseline.");
  }
  if (baseline.latencyAvgMs > 0 && current.latencyAvgMs > baseline.latencyAvgMs * 1.4) {
    lines.push("Thread response latency has increased sharply.");
  }
  if (baseline.afterHoursAvg > 0 && current.afterHoursAvg > baseline.afterHoursAvg * 1.5) {
    lines.push("After-hours communication has spiked relative to baseline.");
  }

  return lines.length ? lines.join(" ") : "No major anomalies detected in the latest 7-day window.";
}

/**
 * Analyzes seven days of collected signals against a four-week baseline.
 * Flags anomalies in volume drops, latency increases, and after-hours spikes,
 * and uses Slack AI to generate a human-readable summary for impacted channels.
 */
export async function analyzeSignals({ client, logger }: { client: SlackClient; logger: Logger }): Promise<AnalysisResult[]> {
  try {
    const records = await listDailyRecords(client);
    if (!records.length) {
      logger.info("PulseCheck: no daily signal records available for analysis");
      return [];
    }

    const channels = new Map<string, DailySignalRecord[]>();
    records.forEach((record) => {
      const list = channels.get(record.channelId) ?? [];
      list.push(record);
      channels.set(record.channelId, list);
    });

    const nowTs = Date.now();
    const currentWindowStart = nowTs - 7 * 24 * 60 * 60 * 1000;
    const baselineWindowStart = nowTs - 35 * 24 * 60 * 60 * 1000;

    const results: AnalysisResult[] = [];

    for (const [channelId, channelRecords] of channels) {
      const sorted = channelRecords.sort((a, b) => parseRecordDate(a) - parseRecordDate(b));
      const currentRecords = sorted.filter((record) => parseRecordDate(record) >= currentWindowStart);
      const baselineRecords = sorted.filter((record) => parseRecordDate(record) >= baselineWindowStart && parseRecordDate(record) < currentWindowStart);
      if (!currentRecords.length || !baselineRecords.length) continue;

      const current = computeAggregate(currentRecords);
      const baseline = computeAggregate(baselineRecords);
      const anomalies = [] as AnalysisResult[];

      if (baseline.volumeAvg > 0 && current.volumeAvg < baseline.volumeAvg * 0.7) {
        anomalies.push({ channel: channelId, signal_type: "volume", severity: "high", summary_text: "Volume drop exceeds 30% relative to the 4-week baseline." });
      }
      if (baseline.latencyAvgMs > 0 && current.latencyAvgMs > baseline.latencyAvgMs * 1.4) {
        anomalies.push({ channel: channelId, signal_type: "latency", severity: "medium", summary_text: "Thread response latency increased by more than 40%." });
      }
      if (baseline.afterHoursAvg > 0 && current.afterHoursAvg > baseline.afterHoursAvg * 1.5) {
        anomalies.push({ channel: channelId, signal_type: "after_hours", severity: "medium", summary_text: "After-hours message volume spiked by more than 50%." });
      }

      if (!anomalies.length) {
        continue;
      }

      const aiSummary = await generateSummary(client, logger, channelId, current, baseline);
      results.push({
        channel: channelId,
        signal_type: "combined",
        severity: anomalies.some((a) => a.severity === "high") ? "high" : "medium",
        summary_text: aiSummary
      });
    }

    logger.info(`PulseCheck: analysis returned ${results.length} anomaly records`);
    return results;
  } catch (error) {
    logger.error("PulseCheck: analyzeSignals failed", error);
    return [];
  }
}
