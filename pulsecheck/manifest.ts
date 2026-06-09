const manifest = {
  name: "PulseCheck",
  description: "A Slack agent that tracks workspace pulse signals, flags anomalies, and provides AI-powered health summaries.",
  version: "0.1.0",
  runtime: "deno",
  permissions: {
    bot: [
      "app_mentions:read",
      "channels:history",
      "channels:read",
      "chat:write",
      "conversations:write",
      "datastore:read",
      "datastore:write",
      "im:read",
      "im:write",
      "reactions:read",
      "team:read",
      "ai:generate",
      "commands"
    ]
  },
  event_subscriptions: {
    bot_events: [
      "app_home_opened",
      "message.channels",
      "message.groups",
      "reaction_added"
    ]
  },
  commands: [
    {
      command: "/pulsecheck",
      description: "Returns an instant health snapshot for a channel.",
      usage_hint: "[channel]",
      handler: "./triggers/slash_command.ts"
    }
  ],
  scheduled_triggers: [
    {
      name: "weekly_pulse_check",
      schedule: "0 9 * * MON",
      handler: "./triggers/scheduled_analysis.ts"
    },
    {
      name: "midweek_pulse_alert",
      schedule: "0 9 * * WED",
      handler: "./triggers/anomaly_alert.ts"
    }
  ],
  functions: {
    collectSignals: "./functions/collect_signals.ts",
    analyzeSignals: "./functions/analyze_signals.ts",
    generateDigest: "./functions/generate_digest.ts",
    mcpConnector: "./functions/mcp_connector.ts"
  },
  views: {
    homeTab: "./views/home_tab.ts",
    snapshotModal: "./views/snapshot_modal.ts"
  },
  datastore: {
    namespace: "pulsecheck_signals"
  }
};

export default manifest;
