/**
 * Utility functions for date formatting
 */

export function formatDreamDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDreamTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toDateString();
}

export function getCurrentMoonCycleTimestamp(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  return `Cycle of the Moon: ${now.toLocaleDateString('en-US', options)}`;
}
