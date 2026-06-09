type SlackClient = Record<string, unknown>;
type Logger = { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

type AnalysisResult = { channel: string; signal_type: string; severity: string; summary_text: string };

const ADMIN_USER_ID = "@workspace_admin";

export async function anomalyAlert({ client, logger, anomalies }: {
  client: SlackClient;
  logger: Logger;
  anomalies: AnalysisResult[];
}): Promise<void> {
  if (!anomalies.length) {
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

  try {
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
