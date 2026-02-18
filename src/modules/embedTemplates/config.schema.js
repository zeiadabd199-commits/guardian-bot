export const moduleSchema = {
  // This module stores templates in a dedicated collection; no per-guild module config required.
};

export function ensureDefaultConfig(existing = {}) { return existing || {}; }
