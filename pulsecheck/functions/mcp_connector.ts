export type ProjectHealth = {
  projectId: string;
  communicationScore: number;
  deliveryScore: number;
  combinedScore: number;
  updatedAt: number;
};

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

export async function mapWebhookToChannelActivity(webhook: Record<string, unknown>): Promise<{ channelId?: string; projectHealth?: ProjectHealth }> {
  const maybeChannel = String(webhook.channel_id ?? webhook.team_channel ?? "");
  const issue = webhook.issue as Record<string, unknown> | undefined;
  const project = webhook.project as Record<string, unknown> | undefined;
  const projectId = String(webhook.project_id ?? issue?.project_id ?? project?.id ?? "unknown");
  const projectHealth = await get_project_health(projectId);
  return { channelId: maybeChannel || undefined, projectHealth };
}
