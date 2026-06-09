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

/**
 * Handles the /pulsecheck slash command and returns an instant health snapshot for a channel.
 * Replies using response_url when available, otherwise sends an ephemeral or channel message.
 */
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
    const responseText = channelResults.length
      ? channelResults.map((item) => `*${item.signal_type}* (${item.severity}): ${item.summary_text}`).join("\n")
      : `No strong anomalies detected for ${displayTarget} at this time.`;

    const responseUrl = payload.response_url as string | undefined;
    const postMessage = (client as any).chat?.postMessage;
    const postEphemeral = (client as any).chat?.postEphemeral;

    if (responseUrl) {
      await fetch(responseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: responseText, response_type: "ephemeral" })
      });
    } else if (typeof postEphemeral === "function" && payload.user_id && payload.channel_id) {
      await postEphemeral({ channel: payload.channel_id, user: payload.user_id, text: responseText });
    } else if (typeof postMessage === "function" && payload.channel_id) {
      await postMessage({ channel: payload.channel_id, text: responseText });
    } else {
      logger.warn("PulseCheck: no available response method for slash command");
    }

    logger.info(`PulseCheck: slash command snapshot delivered for ${targetChannel}`);
  } catch (error) {
    logger.error("PulseCheck: slashCommand failed", error);
  }
}
