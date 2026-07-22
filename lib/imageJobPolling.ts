export const IMAGE_JOB_POLL_DELAYS_MS = [2000, 4000, 8000, 15000] as const;

export const getImageJobPollDelay = (completedPolls: number): number => {
  const normalizedPolls = Number.isFinite(completedPolls)
    ? Math.max(0, Math.floor(completedPolls))
    : 0;
  const index = Math.min(normalizedPolls, IMAGE_JOB_POLL_DELAYS_MS.length - 1);
  return IMAGE_JOB_POLL_DELAYS_MS[index];
};
