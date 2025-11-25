export const blurActiveElement = () => {
  if (typeof document === 'undefined') {
    return;
  }

  const activeElement = document.activeElement as HTMLElement | null;
  activeElement?.blur?.();
};
