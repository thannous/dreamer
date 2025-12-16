export const computeNextInputAfterSend = (currentText: string, sentText: string): string => {
  return currentText.trim() === sentText ? '' : currentText;
};
