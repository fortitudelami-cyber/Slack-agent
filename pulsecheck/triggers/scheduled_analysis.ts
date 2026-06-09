import { analyzeSignals } from "../functions/analyze_signals.ts";
import { generateDigest } from "../functions/generate_digest.ts";

type SlackClient = Record<string, unknown>;
type Logger = { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

/**
 * Scheduled trigger handler for weekly analysis.
 * Runs every Monday at 9am, performs anomaly analysis, and posts the digest report.
 */
export async function scheduledAnalysis({ client, logger }: { client: SlackClient; logger: Logger }): Promise<void> {
  try {
    const anomalies = await analyzeSignals({ client, logger });
    await generateDigest({ client, logger, analysisResults: anomalies });
    logger.info("PulseCheck: scheduled analysis completed");
  } catch (error) {
    logger.error("PulseCheck: scheduledAnalysis failed", error);
  }
}
