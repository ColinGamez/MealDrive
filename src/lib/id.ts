/**
 * Generates a stable, collision-resistant unique ID.
 * Uses crypto.randomUUID() when available (all evergreen browsers + Node 19+),
 * falls back to a getRandomValues-based v4-shape UUID, and finally to
 * Math.random() if even that's missing.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  // Last-resort fallback
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
