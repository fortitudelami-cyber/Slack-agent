# PulseCheck

PulseCheck is a Slack agent built for the Slack Agent Builder Challenge. It gathers public Slack metadata, detects workspace communication anomalies, and surfaces health insights through scheduled summaries, slash commands, and Home tab UI.

## Architecture

```
Slack event metadata -> pulsecheck/functions/collect_signals.ts
Slack datastore -> pulsecheck_signals namespace
Weekly analysis -> pulsecheck/functions/analyze_signals.ts
Digest posting -> pulsecheck/functions/generate_digest.ts
Home UI render -> pulsecheck/views/home_tab.ts
AI query modal -> pulsecheck/views/snapshot_modal.ts
MCP stub -> pulsecheck/functions/mcp_connector.ts
Triggers:
  pulsecheck/triggers/scheduled_analysis.ts
  pulsecheck/triggers/anomaly_alert.ts
  pulsecheck/triggers/slash_command.ts
Manifest entry -> pulsecheck/manifest.ts
```

## Required scopes

- `channels:read`
- `channels:history`
- `chat:write`
- `datastore:read`
- `datastore:write`
- `im:write`
- `reactions:read`
- `team:read`
- `ai:generate`
- `commands`

## Setup

1. Install the Slack CLI and Deno.
2. Put the `pulsecheck` directory in your Slack app workspace.
3. Review `pulsecheck/manifest.ts` and verify permissions.
4. Deploy the app with the Slack CLI.
5. Optionally set `PULSECHECK_ADMIN_USER` to a workspace admin user ID to enable mid-week anomaly DMs.
6. Ensure the bot is invited to public channels used for reporting and monitoring.
7. Configure the scheduled trigger for Monday 9am.

## How it works

- `collect_signals.ts` stores metadata in Slack Datastore, including per-channel daily volume, thread latency, after-hours counts, cross-channel mentions, and reaction summary counts.
- `analyze_signals.ts` examines the latest 7 days against a prior 4-week baseline and flags anomalies using Slack AI to generate natural language summaries.
- `generate_digest.ts` formats a Block Kit report and posts it to `#pulse-check-reports`.
- `scheduled_analysis.ts` runs weekly at Monday 9am to create the digest.
- `anomaly_alert.ts` sends a DM alert to the workspace admin when mid-week anomalies are detected.
- `slash_command.ts` responds to `/pulsecheck [channel]` with an instant health snapshot.
- `home_tab.ts` builds a Home tab view showing the org health score, top flagged channels, and 4-week trend blocks.
- `snapshot_modal.ts` opens a modal for free-text AI queries.
- `mcp_connector.ts` provides a stubbed `get_project_health(project_id)` tool for Jira/Linear integration.

## Demo flow

1. Bot collects metadata from channel messages and reactions.
2. Data is stored in Slack Datastore under `pulsecheck_signals`.
3. Every Monday at 9am, the agent analyzes 7-day activity vs. a 4-week baseline.
4. PulseCheck posts a digest to `#pulse-check-reports` with health scores and top flags.
5. If an anomaly appears mid-week, the workspace admin receives a DM alert.
6. Users can query `/pulsecheck <channel>` for an instant channel snapshot or use Home tab "Ask PulseCheck".

## Notes

- PulseCheck does not store message body content or PII.
- It only collects public metadata and reaction/event signals.
- MCP integration is stubbed and can be extended to map Jira/Linear webhook data to channel activity.
