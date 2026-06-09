import { SlackApp } from "slack-sdk";
import { collectSignals } from "./functions/collect_signals.ts";
import { analyzeSignals } from "./functions/analyze_signals.ts";
import { generateDigest } from "./functions/generate_digest.ts";
import { scheduledAnalysis } from "./triggers/scheduled_analysis.ts";
import { anomalyAlert } from "./triggers/anomaly_alert.ts";
import { slashCommand } from "./triggers/slash_command.ts";
import { buildHomeTab } from "./views/home_tab.ts";
import { buildSnapshotModal } from "./views/snapshot_modal.ts";
import manifest from "./manifest.ts";

type SlackEvent = Record<string, unknown>;
type SlackClient = Record<string, unknown>;
type Logger = { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

/**
 * Initialize the Slack app with all triggers, event handlers, and actions.
 */
const app = new SlackApp({ manifest }) as any;

/**
 * EVENT: app_home_opened — render the PulseCheck Home tab
 */
app.event("app_home_opened", async ({ event, client, logger }: {
  event: SlackEvent;
  client: SlackClient;
  logger: Logger;
}) => {
  try {
    const userId = event.user as string | undefined;
    if (!userId) return;

    const overallScore = 75;
    const topChannels = [
      { channelId: "C123", reason: "Response latency up 40%" },
      { channelId: "C124", reason: "After-hours spike 50%" },
      { channelId: "C125", reason: "Volume drop 30%" }
    ];
    const trendData = [
      { weekStart: "2026-05-19", volume: 150, latencyMs: 450, afterHours: 8 },
      { weekStart: "2026-05-26", volume: 155, latencyMs: 470, afterHours: 10 },
      { weekStart: "2026-06-02", volume: 140, latencyMs: 520, afterHours: 18 },
      { weekStart: "2026-06-09", volume: 100, latencyMs: 650, afterHours: 25 }
    ];

    const homeView = buildHomeTab({ overallScore, topChannels, trendData });
    const viewsPublish = (client as any).views?.publish;
    if (typeof viewsPublish === "function") {
      await viewsPublish({ user_id: userId, view: homeView });
      logger.info(`PulseCheck: Home tab published for user ${userId}`);
    }
  } catch (error) {
    logger.error("PulseCheck: app_home_opened failed", error);
  }
});

/**
 * EVENT: message.channels — collect metadata signals
 */
app.event("message.channels", async ({ event, client, logger }: {
  event: SlackEvent;
  client: SlackClient;
  logger: Logger;
}) => {
  await collectSignals({ event, client, logger });
});

/**
 * EVENT: reaction_added — record reaction counts
 */
app.event("reaction_added", async ({ event, client, logger }: {
  event: SlackEvent;
  client: SlackClient;
  logger: Logger;
}) => {
  await collectSignals({ event, client, logger });
});

/**
 * SLASH COMMAND: /pulsecheck — return channel health snapshot
 */
app.command("/pulsecheck", async ({ payload, client, logger }: {
  payload: Record<string, unknown>;
  client: SlackClient;
  logger: Logger;
}) => {
  await slashCommand({ payload: payload as any, client, logger });
});

/**
 * SCHEDULED: weekly_pulse_check — Monday 9am digest
 */
app.scheduled("weekly_pulse_check", async ({ client, logger }: {
  client: SlackClient;
  logger: Logger;
}) => {
  await scheduledAnalysis({ client, logger });
});

/**
 * SCHEDULED: midweek_pulse_alert — Wednesday 9am anomaly check
 */
app.scheduled("midweek_pulse_alert", async ({ client, logger }: {
  client: SlackClient;
  logger: Logger;
}) => {
  await anomalyAlert({ client, logger });
});

/**
 * ACTION: open_pulsecheck_modal — open the free-text query modal
 */
app.action("open_pulsecheck_modal", async ({ ack, body, client, logger }: {
  ack: () => Promise<void>;
  body: Record<string, unknown>;
  client: SlackClient;
  logger: Logger;
}) => {
  await ack();
  try {
    const triggerId = body.trigger_id as string | undefined;
    const channelId = (body as any).channel?.id as string | undefined;
    if (!triggerId) return;

    const modal = buildSnapshotModal({ channelId: channelId || "" });
    const viewsOpen = (client as any).views?.open;
    if (typeof viewsOpen === "function") {
      await viewsOpen({ trigger_id: triggerId, view: modal });
      logger.info("PulseCheck: snapshot modal opened");
    }
  } catch (error) {
    logger.error("PulseCheck: open_pulsecheck_modal failed", error);
  }
});

/**
 * ACTION: pulsecheck_snapshot_modal submit — process AI query and show results
 */
app.view("pulsecheck_snapshot_modal", async ({ ack, body, client, logger }: {
  ack: () => Promise<void>;
  body: Record<string, unknown>;
  client: SlackClient;
  logger: Logger;
}) => {
  await ack();
  try {
    const values = (body.view as any)?.state?.values;
    const query = values?.query_input?.query?.value as string | undefined;
    const project = values?.project_input?.project?.value as string | undefined;

    if (!query) {
      logger.warn("PulseCheck: modal submit with no query");
      return;
    }

    const results = await analyzeSignals({ client, logger });
    const responseText = results.length
      ? `Query: "${query}"\n\nAnalysis:\n${results.slice(0, 3).map((r) => `• <#${r.channel}>: ${r.summary_text}`).join("\n")}`
      : `Query: "${query}"\n\nNo anomalies detected at this time.`;

    const triggerId = body.trigger_id as string | undefined;
    const viewsUpdate = (client as any).views?.update;
    if (typeof viewsUpdate === "function" && triggerId && (body.view as any)?.id) {
      const updatedView = {
        id: (body.view as any).id,
        view: {
          type: "modal",
          title: { type: "plain_text", text: "PulseCheck Results" },
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: responseText } },
            { type: "context", elements: [{ type: "mrkdwn", text: project ? `Project/delivery context: ${project}` : "Analyzed with communication metadata only." }] }
          ]
        }
      };
      await viewsUpdate(updatedView);
      logger.info("PulseCheck: modal results published");
    }
  } catch (error) {
    logger.error("PulseCheck: pulsecheck_snapshot_modal submit failed", error);
  }
});

export default app;
