/** Leave the title/date inside the first viewport, with a small bottom gutter. */
export function getDreamCoverLayout(width: number, availableHeight: number, captionHeight: number) {
  const portraitHeight = Math.max(0, width) * 16 / 9;
  const captionOverlap = 50;
  const captionTop = Math.max(0, Math.min(
    portraitHeight - captionOverlap,
    availableHeight - captionHeight - 16,
  ));

  return {
    imageHeight: Math.min(portraitHeight, captionTop + captionOverlap),
    captionTop,
  };
}
