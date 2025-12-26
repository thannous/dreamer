export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shouldResetDailyProgress(previousDateKey: string, date: Date = new Date()): boolean {
  return previousDateKey !== getLocalDateKey(date);
}

