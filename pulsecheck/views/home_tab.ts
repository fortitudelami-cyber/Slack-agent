type HealthTrend = {
  weekStart: string;
  volume: number;
  latencyMs: number;
  afterHours: number;
};

type HomeTabProps = {
  overallScore: number;
  topChannels: Array<{ channelId: string; reason: string }>;
  trendData: HealthTrend[];
};

function buildTrendSection(trendData: HealthTrend[]) {
  if (!trendData.length) {
    return [{ type: "section", text: { type: "mrkdwn", text: "No trend data available yet." } }];
  }

  const trendHeader = {
    type: "section",
    text: { type: "mrkdwn", text: "*Trend overview (last 4 weeks)*" }
  };

  const trendRows = trendData.map((trend) => ({
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*Week:* ${trend.weekStart}` },
      { type: "mrkdwn", text: `*Volume:* ${trend.volume.toFixed(0)}` },
      { type: "mrkdwn", text: `*Latency:* ${trend.latencyMs.toFixed(0)}ms` },
      { type: "mrkdwn", text: `*After-hours:* ${trend.afterHours.toFixed(0)}` }
    ]
  }));

  return [trendHeader, ...trendRows];
}

/**
 * Builds the PulseCheck Home tab view with overall health score, flagged channels, and trends.
 * Uses Block Kit sections and fields for a clean, responsive dashboard experience.
 */
export function buildHomeTab({ overallScore, topChannels, trendData }: HomeTabProps) {
  const topList = topChannels.slice(0, 3).map((item, index) => ({
    type: "mrkdwn",
    text: `*${index + 1}.* <#${item.channelId}>\n${item.reason}`
  }));

  return {
    type: "home",
    blocks: [
      { type: "header", text: { type: "plain_text", text: "PulseCheck Workspace Health" } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Overall health score:* *${overallScore}/100*\nPulseCheck measures reaction activity, thread latency, and after-hours volume to identify early signs of disengagement and burnout risk.`
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Top flagged channels*\n${topList.length ? topList.map((block) => block.text).join("\n\n") : "No flags detected."}` },
          { type: "mrkdwn", text: `*Action*\nPress "Ask PulseCheck" to ask for a custom health summary or delivery risk insight.` }
        ]
      },
      { type: "divider" },
      ...buildTrendSection(trendData),
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: "If you want a quick follow-up, ask PulseCheck about a specific channel or project and it will combine metadata trends with delivery health context." }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            action_id: "open_pulsecheck_modal",
            text: { type: "plain_text", text: "Ask PulseCheck" },
            style: "primary",
            value: "ask_pulsecheck"
          }
        ]
      }
    ]
  };
}
