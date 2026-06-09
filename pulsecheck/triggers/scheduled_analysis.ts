import { analyzeSignals } from "../functions/analyze_signals.ts";
import { generateDigest } from "../functions/generate_digest.ts";

type SlackClient = Record<string, unknown>;
type Logger = { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

export async function scheduledAnalysis({ client, logger }: { client: SlackClient; logger: Logger }): Promise<void> {
  try {
    const anomalies = await analyzeSignals({ client, logger });
    await generateDigest({ client, logger, analysisResults: anomalies });
    logger.info("PulseCheck: scheduled analysis completed");
  } catch (error) {
    logger.error("PulseCheck: scheduledAnalysis failed", error);
  }
}
