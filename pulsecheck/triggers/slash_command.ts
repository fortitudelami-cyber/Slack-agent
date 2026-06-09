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

export async function slashCommand({ payload, client, logger }: {
  payload: CommandPayload;
  client: SlackClient;
  logger: Logger;
}): Promise<void> {
  try {
    const targetChannel = payload.text?.trim() || payload.channel_id;
    const results = await analyzeSignals({ client, logger });
    const channelResults = results.filter((item) => item.channel === targetChannel);
    const responseText = channelResults.length
      ? channelResults.map((item) => `*${item.signal_type}* (${item.severity}): ${item.summary_text}`).join("\n")
      : `No strong anomalies detected for <#${targetChannel}> at this time.`;

    const respond = (client as any).response?.send || (client as any).chat?.postMessage;
    if (typeof respond === "function") {
      await respond({ channel: payload.channel_id, text: responseText });
    }

    logger.info(`PulseCheck: slash command snapshot delivered for ${targetChannel}`);
  } catch (error) {
    logger.error("PulseCheck: slashCommand failed", error);
  }
}
