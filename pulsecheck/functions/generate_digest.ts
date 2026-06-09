type SlackClient = Record<string, unknown>;
type Logger = { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
type AnalysisResult = { channel: string; signal_type: string; severity: string; summary_text: string };

type HealthScore = { overall: number; highFlags: number; mediumFlags: number; lowFlags: number };

const REPORT_CHANNEL = "#pulse-check-reports";

function calculateHealthScore(results: AnalysisResult[]): HealthScore {
  const highFlags = results.filter((result) => result.severity === "high").length;
  const mediumFlags = results.filter((result) => result.severity === "medium").length;
  const lowFlags = results.filter((result) => result.severity === "low").length;
  const penalty = Math.min(60, highFlags * 15 + mediumFlags * 10 + lowFlags * 5);
  return { overall: Math.max(40, 100 - penalty), highFlags, mediumFlags, lowFlags };
}

function buildDigestBlocks(results: AnalysisResult[]) {
  const score = calculateHealthScore(results);
  const summaryLines = results.slice(0, 3).map((item) => `• <#${item.channel}> — ${item.signal_type} (${item.severity})`);

  return [
    { type: "header", text: { type: "plain_text", text: "PulseCheck Weekly Digest" } },
    { type: "section", text: { type: "mrkdwn", text: `*Organization health score:* ${score.overall}/100` } },
    { type: "section", text: { type: "mrkdwn", text: `*Flags detected:* ${score.highFlags} high, ${score.mediumFlags} medium, ${score.lowFlags} low` } },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: "*Top flagged channels*" } },
    ...summaryLines.map((text) => ({ type: "section", text: { type: "mrkdwn", text } })),
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: "Review the flagged channels above and inspect thread responsiveness, after-hours volume, and reaction health." } },
    { type: "context", elements: [{ type: "mrkdwn", text: "PulseCheck uses Slack Datastore metadata and Slack AI summaries to highlight anomalies." }] }
  ];
}

export async function generateDigest({ client, logger, analysisResults }: {
  client: SlackClient;
  logger: Logger;
  analysisResults: AnalysisResult[];
}): Promise<void> {
  if (!analysisResults.length) {
    logger.info("PulseCheck: no anomalies to include in digest");
    return;
  }

  const blocks = buildDigestBlocks(analysisResults);
  const chatPost = (client as any).chat?.postMessage;
  if (typeof chatPost !== "function") {
    logger.warn("PulseCheck: chat.postMessage not available");
    return;
  }

  try {
    await chatPost({ channel: REPORT_CHANNEL, blocks, text: "PulseCheck weekly digest" });
    logger.info("PulseCheck: weekly digest posted to pulse-check-reports");
  } catch (error) {
    logger.error("PulseCheck: failed to post digest", error);
  }
}
