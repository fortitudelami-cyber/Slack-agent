# PulseCheck Submission

## Project description

PulseCheck is a Slack agent built to help teams detect early signs of communication breakdown, disengagement, and burnout using only public metadata signals. The agent avoids reading message body content or storing private threads by collecting channel-level volume, thread response latency, after-hours activity, cross-channel mentions, and reaction emoji counts. These signals are persisted in Slack Datastore and analyzed over rolling windows so that the most important changes are compared against a four-week baseline.

When a channel drops below 70% of its baseline volume, when thread latency increases by more than 40%, or when after-hours activity spikes beyond 50%, PulseCheck flags the channel and generates a concise natural-language summary using Slack AI. The agent surfaces those insights through an App Home dashboard, a weekly digest report, and an on-demand `/pulsecheck` command. The Home tab presents an overall health score, a ranked list of top flagged channels, and four-week trend context to make it easy for workspace leaders to take action.

A dedicated mid-week alert trigger notifies the workspace admin if critical anomalies appear. The agent includes an MCP stub ready to map Jira or Linear webhook data to combined communication and delivery health scores, enabling communication and delivery health to be considered together.

PulseCheck is especially useful in hybrid and remote teams where delayed thread responses, invisible cross-team mentions, and irregular after-hours messaging can be early signs of overload or burnout. By surfacing those metrics in a dashboard and digest, the agent gives leaders a shared, actionable view of engagement health and helps teams rebalance work before performance and morale suffer.

PulseCheck is designed to work with Slack CLI and Deno, preserve privacy by storing only metadata in Slack Datastore, and reduce disengagement costs by making team stress signals visible early. It also supports a shared reporting lens for team health decisions.

## Slack technologies used

- Slack Datastore: stores daily metadata signals such as channel volume, thread latency, after-hours counts, cross-channel mentions, and reaction totals in a secure, bot-managed datastore.
- Slack AI: generates natural language anomaly summaries and powers an "Ask PulseCheck" query experience, turning raw signal comparisons into human-friendly insights.
- Block Kit + App Home + Slash Commands + Scheduled Triggers: provides a polished workspace dashboard, a `/pulsecheck` snapshot command, weekly digest delivery, and an interactive modal for follow-up questions.

## Impact statement

PulseCheck focuses on the burnout and disengagement cost angle by surfacing patterns that often precede team fatigue: falling channel volume, rising thread latency, and increases in after-hours messaging. By identifying these signals early, organizations can act before small communication issues become expensive productivity losses.

## Demo script

1. Start on the PulseCheck Home tab and show the overall health score, flagged channels, and four-week trend blocks.
2. Open the "Ask PulseCheck" modal and submit a question about channel health or delivery risk.
3. Show the `/pulsecheck #channel-name` slash command returning an instant snapshot.
4. Walk through the weekly digest posted to `#pulse-check-reports`, highlighting the calculated score and top anomaly flags.
5. Explain how the MCP stub can enrich results with project delivery health and how the agent keeps only metadata in the datastore.

## ASCII architecture diagram

```
Slack events --> pulsecheck/functions/collect_signals.ts
                   |      gathers metadata into Slack Datastore
                   V
     pulsecheck/functions/analyze_signals.ts
                   |      compares 7-day trends vs 4-week baseline
                   V
     pulsecheck/functions/generate_digest.ts
                   |      posts Block Kit digest to #pulse-check-reports
                   V
     pulsecheck/triggers/scheduled_analysis.ts

Home tab UI --> pulsecheck/views/home_tab.ts
Modal UI --> pulsecheck/views/snapshot_modal.ts
MCP stub --> pulsecheck/functions/mcp_connector.ts
```

## Manifest scope confirmation

The `pulsecheck/manifest.ts` file includes the correct bot scopes for PulseCheck:

- `channels:history` for channel metadata access
- `reactions:read` for reaction counting
- `team:read` for workspace membership and channel details
- `datastore:read` and `datastore:write` for Slack Datastore persistence
- `ai:generate` for Slack AI summary generation
- `conversations:write` and `chat:write` for message delivery and admin alerts
- `commands` for `/pulsecheck`

This manifest supports Slack AI summary calls, datastore storage, and MCP-style tool integration while avoiding any message body storage.
