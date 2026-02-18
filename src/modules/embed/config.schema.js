export function ensureDefaultConfig(cfg = {}) {
  const defaults = {
    templates: {},
  };
  return { ...defaults, ...(cfg || {}) };
}
