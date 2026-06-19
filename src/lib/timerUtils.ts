/**
 * Utility to parse time durations from recipe instructions.
 * Detects patterns like "10 minutes", "5 mins", "1 hour", etc.
 */

export interface DetectedTimer {
  durationSeconds: number;
  label: string;
}

export function detectTimers(text: string): DetectedTimer[] {
  const timers: DetectedTimer[] = [];

  // Regex to find patterns like "10 minutes", "5 mins", "1 hour", "30 seconds"
  // Supports: min, mins, minute, minutes, hr, hrs, hour, hours, sec, secs, second, seconds
  const timeRegex = /(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs|second|seconds|sec|secs)\b/gi;

  let match;
  while ((match = timeRegex.exec(text)) !== null) {
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    let durationSeconds = 0;
    if (unit.startsWith('hour') || unit.startsWith('hr')) {
      durationSeconds = value * 3600;
    } else if (unit.startsWith('min')) {
      durationSeconds = value * 60;
    } else if (unit.startsWith('sec')) {
      durationSeconds = value;
    }

    if (durationSeconds > 0) {
      timers.push({
        durationSeconds,
        label: match[0],
      });
    }
  }

  return timers;
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
