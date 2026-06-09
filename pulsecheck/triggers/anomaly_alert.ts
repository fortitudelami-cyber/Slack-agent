import { analyzeSignals } from "../functions/analyze_signals.ts";

type SlackClient = Record<string, unknown>;
type Logger = { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

type AnalysisResult = { channel: string; signal_type: string; severity: string; summary_text: string };

const ADMIN_USER_ID = typeof Deno !== "undefined" ? Deno.env.get("PULSECHECK_ADMIN_USER") ?? "" : "";

/**
 * Runs anomaly analysis and sends a direct message alert to the workspace admin.
 * This mid-week trigger highlights channels with critical anomalies.
 */
export async function anomalyAlert({ client, logger }: { client: SlackClient; logger: Logger }): Promise<void> {
  try {
    if (!ADMIN_USER_ID) {
      logger.warn("PulseCheck: PULSECHECK_ADMIN_USER environment variable is not set. Skipping anomaly alert.");
      return;
    }
    const anomalies = await analyzeSignals({ client, logger });
    if (!anomalies.length) {
      logger.info("PulseCheck: no mid-week anomalies found");
      return;
    }

    const message = anomalies.slice(0, 3).map((item) => `• <#${item.channel}>: ${item.signal_type} (${item.severity}) — ${item.summary_text}`).join("\n");
    const text = `PulseCheck detected anomalies mid-week:\n${message}`;

    const openIm = (client as any).conversations?.open;
    const postMessage = (client as any).chat?.postMessage;

    if (typeof openIm !== "function" || typeof postMessage !== "function") {
      logger.warn("PulseCheck: unable to send anomaly alert because chat or conversations is unavailable");
      return;
    }

    const dm = await openIm({ users: ADMIN_USER_ID });
    const channel = dm?.channel?.id;
    if (!channel) {
      logger.warn("PulseCheck: failed to open DM for admin alert");
      return;
    }

    await postMessage({ channel, text });
    logger.info("PulseCheck: anomaly alert sent to workspace admin");
  } catch (error) {
    logger.error("PulseCheck: anomalyAlert failed", error);
  }
}
