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

  const header = {
    type: "section",
    text: { type: "mrkdwn", text: "*Trend overview (last 4 weeks)*\n_week start · volume · latency · after-hours_" }
  };

  const rows = trendData.map((trend) => ({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${trend.weekStart}* · ${trend.volume.toFixed(0)} msgs · ${trend.latencyMs.toFixed(0)}ms · ${trend.afterHours.toFixed(0)} after-hours`
    }
  }));

  return [header, ...rows];
}

export function buildHomeTab({ overallScore, topChannels, trendData }: HomeTabProps) {
  return {
    type: "home",
    blocks: [
      { type: "header", text: { type: "plain_text", text: "PulseCheck Workspace Health" } },
      { type: "section", text: { type: "mrkdwn", text: `*Overall health score:* ${overallScore}/100\nPulseCheck aggregates signal volume, thread latency, and after-hours activity to help you monitor workspace balance.` } },
      { type: "divider" },
      { type: "section", text: { type: "mrkdwn", text: "*Top 3 flagged channels this week*" } },
      ...topChannels.slice(0, 3).map((item) => ({
        type: "section",
        text: { type: "mrkdwn", text: `• <#${item.channelId}> — ${item.reason}` }
      })),
      { type: "divider" },
      ...buildTrendSection(trendData),
      { type: "divider" },
      { type: "actions", elements: [
        {
          type: "button",
          action_id: "open_pulsecheck_modal",
          text: { type: "plain_text", text: "Ask PulseCheck" },
          value: "ask_pulsecheck"
        }
      ] }
    ]
  };
}
