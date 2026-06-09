# PulseCheck Submission

## Inspiration

Most employee engagement programs rely on surveys, but Gallup estimates $8.9 trillion is lost every year to disengaged teams. Surveys are often lagging indicators because people avoid them, answer in the socially desirable way, or simply do not respond. Meanwhile the real story is already in Slack: the timing of replies, after-hours volume, reaction behavior, and who mentions whom all become behavioral signals that show how teams are actually working together.

## What it does

PulseCheck gathers five public Slack signals without reading message content: channel message volume, thread response latency, after-hours message counts, cross-team mention frequency, and reaction emoji totals. It stores those signals in Slack Datastore and compares the latest seven days to a four-week baseline. The health score is explicit: volume drops beyond 20% incur a penalty, latency increases over 25% incur a penalty, after-hours growth over 30% incurs a penalty, and positive cross-team mention growth can add a bonus. The result is a 0-100 score that highlights communication health rather than guessing from surveys.

Users can interact with PulseCheck three ways. The `/pulsecheck` slash command returns an instant channel snapshot, the App Home tab shows overall health, top flags, and a trend view, and a Monday digest posts the weekly report into `#pulse-check-reports`. An MCP stub is also included so Jira/Linear project health can be blended with Slack communication health for delivery-aware insights.

## How we built it

We built PulseCheck with the Slack CLI and Deno, using Slack’s Real-Time Search-style metadata collection to capture public event signals. Slack AI turns the raw comparisons into natural language summaries so alerts feel readable and actionable. A lightweight MCP server stub connects Jira/Linear-style data to channel health, and Slack Datastore persists all the behavioral signal state.

## Challenges

The hardest part was staying metadata-only while still creating meaningful insights. We needed to avoid content tracking entirely and still surface real engagement risk. We also had to calibrate the health score formula carefully so it would catch issues without generating too many false positives, and we designed the thresholds to be interpretable rather than opaque.

## Accomplishments

PulseCheck became the first behavioral analytics tool in this project that requires zero user input beyond normal Slack activity. The UI is clean and native because it uses Block Kit, App Home, and modal workflows. We also used all three required Slack technologies in meaningful ways: datastore persistence, AI summaries, and app interactions.

## What we learned

We learned the practical limits of Slack’s RTS-style signal collection and how much can be inferred from metadata alone. We also learned how to chain Slack AI summaries into a workflow so raw scores become readable guidance. Finally, we gained experience with MCP server integration patterns for linking delivery tools to Slack health signals.

## What's next

Future work will make baselines adaptive with machine learning instead of fixed thresholds, add manager coaching tips alongside alerts, and introduce team comparison benchmarking so leaders can spot relative engagement gaps. We also want to connect native Salesforce/CRM signals so communication health can be tied to customer and pipeline delivery.
