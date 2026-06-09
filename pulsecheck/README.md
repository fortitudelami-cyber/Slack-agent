# PulseCheck

PulseCheck is a Slack agent built for the Slack Agent Builder Challenge. It gathers public Slack metadata, detects workspace communication anomalies, and surfaces health insights through scheduled summaries, slash commands, and Home tab UI.

## Quick Demo

1. Run the app: `slack run`
2. Seed demo data: `deno run --allow-env --allow-net scripts/seed_demo_data.ts`
3. Try the slash command: `/pulsecheck engineering`
4. Check the Home tab: Click on PulseCheck app to see the dashboard
5. Trigger the digest: `slack triggers invoke weekly_pulse_check` (or wait until Monday 9am)
6. Try the Ask modal: Press "Ask PulseCheck" in the Home tab

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

- `app.ts` is the Slack app entrypoint that registers all event handlers, triggers, and actions.
- `collect_signals.ts` stores metadata in Slack Datastore, including per-channel daily volume, thread latency, after-hours counts, cross-channel mentions, and reaction summary counts.
- `analyze_signals.ts` examines the latest 7 days against a prior 4-week baseline and flags anomalies using Slack AI to generate natural language summaries.
- `calculate_health_score()` formula: starts at 75, applies -2 per % volume drop (beyond 20%), -1.5 per % latency increase (beyond 25%), -3 per % after-hours spike (beyond 30%), and +1 per % cross-team mentions (up to +10). Floored at 0, capped at 100.
- `generate_digest.ts` formats a Block Kit report and posts it to `#pulse-check-reports`.
- `scheduled_analysis.ts` runs weekly at Monday 9am to create the digest.
- `anomaly_alert.ts` runs mid-week (Wednesday 9am) and sends a DM alert to the workspace admin (via `PULSECHECK_ADMIN_USER` env var).
- `slash_command.ts` responds to `/pulsecheck [channel]` with a rich Block Kit snapshot including a score, severity badges, and trend arrows.
- `home_tab.ts` builds a Home tab view showing the org health score, top flagged channels, and 4-week trend blocks.
- `snapshot_modal.ts` opens a modal for free-text AI queries; on submit, `app.ts` handles the submission, calls `analyzeSignals`, and updates the modal with results.
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
