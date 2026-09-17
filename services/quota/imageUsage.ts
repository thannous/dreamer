type ImageUsageDream = {
  imageUrl?: string;
  imageSource?: 'user' | 'ai';
};

export function isAiGeneratedImage(dream: ImageUsageDream | null | undefined): boolean {
  if (!dream) return false;
  if (dream.imageSource === 'user') return false;
  return Boolean(dream.imageUrl?.trim());
}

export function countAiGeneratedImages(dreams: (ImageUsageDream | null | undefined)[]): number {
  return dreams.filter(isAiGeneratedImage).length;
}
