export function createEmptyProgress() {
  return {
    completedStageIds: [],
    currentStageId: null,
    bossCleared: false,
    updatedAt: null,
  };
}

export function normalizeProgress(value) {
  const completedStageIds = Array.isArray(value?.completedStageIds)
    ? [...new Set(value.completedStageIds.filter((id) => typeof id === 'string' && id.length > 0))]
    : [];

  return {
    completedStageIds,
    currentStageId: typeof value?.currentStageId === 'string' ? value.currentStageId : null,
    bossCleared: value?.bossCleared === true,
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : null,
  };
}

export function mergeProgress(base, incoming) {
  const previous = normalizeProgress(base);
  const next = normalizeProgress(incoming);

  return {
    completedStageIds: [...new Set([...previous.completedStageIds, ...next.completedStageIds])],
    currentStageId: Object.hasOwn(incoming ?? {}, 'currentStageId')
      ? next.currentStageId
      : previous.currentStageId,
    bossCleared: previous.bossCleared || next.bossCleared,
    updatedAt: new Date().toISOString(),
  };
}
