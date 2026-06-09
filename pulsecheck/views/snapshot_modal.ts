/**
 * Builds a modal for free-text PulseCheck AI queries.
 * Users can ask about channel health, team engagement, or delivery risk.
 */
export function buildSnapshotModal({ channelId }: { channelId: string }) {
  return {
    type: "modal",
    callback_id: "pulsecheck_snapshot_modal",
    title: { type: "plain_text", text: "Ask PulseCheck" },
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Close" },
    blocks: [
      {
        type: "input",
        block_id: "query_input",
        label: { type: "plain_text", text: channelId ? `Ask about <#${channelId}> or workspace health` : "Ask about workspace health" },
        element: {
          type: "plain_text_input",
          multiline: true,
          action_id: "query"
        }
      },
      {
        type: "input",
        optional: true,
        block_id: "project_input",
        label: { type: "plain_text", text: "Optional project or delivery topic" },
        element: {
          type: "plain_text_input",
          action_id: "project"
        }
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: "PulseCheck can combine communication metadata with project health data from the MCP stub." }]
      }
    ]
  };
}
