export type ProjectHealth = {
  projectId: string;
  communicationScore: number;
  deliveryScore: number;
  combinedScore: number;
  updatedAt: number;
};

/**
 * Stubbed MCP tool that returns a synthetic project health score.
 * This can be extended with Jira or Linear webhook data for delivery health integration.
 */
export async function get_project_health(project_id: string): Promise<ProjectHealth> {
  const communicationScore = Math.floor(55 + Math.random() * 40);
  const deliveryScore = Math.floor(50 + Math.random() * 45);
  const combinedScore = Math.round((communicationScore * 0.55 + deliveryScore * 0.45));

  return {
    projectId: project_id,
    communicationScore,
    deliveryScore,
    combinedScore,
    updatedAt: Date.now()
  };
}

/**
 * Maps incoming project webhook payloads to channel activity and project health.
 * Returns a channel mapping and the combinated communication/delivery score.
 */
export async function mapWebhookToChannelActivity(webhook: Record<string, unknown>): Promise<{ channelId?: string; projectHealth?: ProjectHealth }> {
  const maybeChannel = String(webhook.channel_id ?? webhook.team_channel ?? "");
  const issue = webhook.issue as Record<string, unknown> | undefined;
  const project = webhook.project as Record<string, unknown> | undefined;
  const projectId = String(webhook.project_id ?? issue?.project_id ?? project?.id ?? "unknown");
  const projectHealth = await get_project_health(projectId);
  return { channelId: maybeChannel || undefined, projectHealth };
}
