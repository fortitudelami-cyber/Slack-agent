import { analyzeSignals } from "../functions/analyze_signals.ts";

type SlackClient = Record<string, unknown>;
type Logger = { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

type CommandPayload = {
  command: string;
  text?: string;
  user_id?: string;
  channel_id?: string;
  response_url?: string;
};

function getScoreColor(score: number): string {
  if (score >= 70) return "#36a64f";
  if (score >= 40) return "#ffa500";
  return "#d63031";
}

function getSeverityEmoji(severity: string): string {
  if (severity === "high") return "🔴";
  if (severity === "medium") return "🟡";
  return "🟢";
}

function getTrendArrow(current: number, baseline: number): string {
  if (current > baseline * 1.1) return "📈";
  if (current < baseline * 0.9) return "📉";
  return "→";
}

function buildHealthSnapshotBlocks(channelId: string, results: any[], score: number) {
  const scoreColor = getScoreColor(score);
  const topAnomalies = results.slice(0, 3);

  return [
    { type: "header", text: { type: "plain_text", text: `<#${channelId}> Health Snapshot` } },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Health Score*\n<span style="color:${scoreColor}">*${score}/100*</span>` },
        { type: "mrkdwn", text: score >= 70 ? "*Status*\n✅ Healthy" : score >= 40 ? "*Status*\n⚠️ Caution" : "*Status*\n❌ At Risk" }
      ]
    },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: "*Recent signals*" } },
    ...topAnomalies.map((item) => ({
      type: "section",
      text: { type: "mrkdwn", text: `${getSeverityEmoji(item.severity)} ${item.signal_type}: ${item.summary_text}` }
    })),
    { type: "divider" },
    { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "View full report" }, action_id: "view_full_report", value: channelId }] }
  ];
}

export async function slashCommand({ payload, client, logger }: {
  payload: CommandPayload;
  client: SlackClient;
  logger: Logger;
}): Promise<void> {
  try {
    const targetChannel = payload.text?.trim() || payload.channel_id || "";
    const results = await analyzeSignals({ client, logger });
    const channelResults = targetChannel ? results.filter((item) => item.channel === targetChannel) : [];
    const displayTarget = targetChannel ? `<#${targetChannel}>` : "this channel";
    let score = 75;

    if (channelResults.length > 0) {
      const severity = channelResults[0].severity;
      score = severity === "high" ? 45 : severity === "medium" ? 60 : 75;
    }

    let blocks: any[] = [];
    if (channelResults.length) {
      blocks = buildHealthSnapshotBlocks(targetChannel, channelResults, score);
    } else {
      blocks = [
        { type: "header", text: { type: "plain_text", text: `${displayTarget} Health Snapshot` } },
        { type: "section", text: { type: "mrkdwn", text: `*Health Score:* 85/100\n*Status:* ✅ No strong anomalies detected.` } }
      ];
    }

    const responseUrl = payload.response_url as string | undefined;
    const postMessage = (client as any).chat?.postMessage;
    const postEphemeral = (client as any).chat?.postEphemeral;

    if (responseUrl) {
      await fetch(responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks, text: "Channel health snapshot", response_type: "ephemeral" })
      });
    } else if (typeof postEphemeral === "function" && payload.user_id && payload.channel_id) {
      await postEphemeral({ channel: payload.channel_id, user: payload.user_id, blocks, text: "Channel health snapshot" });
    } else if (typeof postMessage === "function" && payload.channel_id) {
      await postMessage({ channel: payload.channel_id, blocks, text: "Channel health snapshot" });
    } else {
      logger.warn("PulseCheck: no available response method for slash command");
    }

    logger.info(`PulseCheck: slash command snapshot delivered for ${targetChannel}`);
  } catch (error) {
    logger.error("PulseCheck: slashCommand failed", error);
  }
}
