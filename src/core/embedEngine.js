import { logger } from './logger.js';
import { getGuildConfig, updateGuildConfig } from './database.js';

const CACHE = new Map(); // guildId -> { templates: Map(name->template) }
const HARD_LIMIT = 30;

function validateTemplate(name, tpl) {
  if (!name || typeof name !== 'string') throw new Error('Template name must be a non-empty string');
  if (!tpl || typeof tpl !== 'object') throw new Error('Template data must be an object');
  if (tpl.title && typeof tpl.title !== 'string') throw new Error('title must be a string');
  if (tpl.description && typeof tpl.description !== 'string') throw new Error('description must be a string');
  if (tpl.color && typeof tpl.color !== 'number') throw new Error('color must be a number');
  if (tpl.fields) {
    if (!Array.isArray(tpl.fields)) throw new Error('fields must be an array');
    if (tpl.fields.length > 25) throw new Error('fields exceed maximum of 25');
    for (const f of tpl.fields) {
      if (!f.name || !f.value) throw new Error('field entries must have name and value');
    }
  }
  return true;
}

async function loadGuildTemplates(guildId) {
  if (CACHE.has(guildId)) return CACHE.get(guildId);
  const cfg = await getGuildConfig(guildId);
  const moduleCfg = (cfg && cfg.modules && cfg.modules.embed) ? cfg.modules.embed : { templates: {} };
  const templates = new Map(Object.entries(moduleCfg.templates || {}));
  const entry = { templates, raw: moduleCfg };
  CACHE.set(guildId, entry);
  logger.info(`embedEngine: loaded ${templates.size} templates for guild ${guildId}`);
  return entry;
}

async function persistGuildTemplates(guildId, templatesObj) {
  const cfg = await getGuildConfig(guildId);
  const modules = cfg.modules || {};
  const embedCfg = { templates: templatesObj };
  await updateGuildConfig(guildId, { modules: { ...modules, embed: embedCfg } });
  CACHE.set(guildId, { templates: new Map(Object.entries(templatesObj)), raw: embedCfg });
}

export async function createEmbed(guildId, name, data) {
  const entry = await loadGuildTemplates(guildId);
  if (entry.templates.has(name)) throw new Error('Template with that name already exists');
  if (entry.templates.size >= HARD_LIMIT) throw new Error('Hard limit reached: maximum templates per guild');
  validateTemplate(name, data);
  const obj = Object.fromEntries([...entry.templates.entries()].concat([[name, data]]));
  await persistGuildTemplates(guildId, obj);
  logger.info(`embedEngine: created template '${name}' for guild ${guildId}`);
  return data;
}

export async function updateEmbed(guildId, name, data) {
  const entry = await loadGuildTemplates(guildId);
  if (!entry.templates.has(name)) throw new Error('Template not found');
  validateTemplate(name, data);
  const obj = Object.fromEntries([...entry.templates.entries()].map(([k, v]) => k === name ? [k, data] : [k, v]));
  await persistGuildTemplates(guildId, obj);
  logger.info(`embedEngine: updated template '${name}' for guild ${guildId}`);
  return data;
}

export async function deleteEmbed(guildId, name) {
  const entry = await loadGuildTemplates(guildId);
  if (!entry.templates.has(name)) throw new Error('Template not found');
  const obj = Object.fromEntries([...entry.templates.entries()].filter(([k]) => k !== name));
  await persistGuildTemplates(guildId, obj);
  logger.info(`embedEngine: deleted template '${name}' for guild ${guildId}`);
  return true;
}

export async function getEmbed(guildId, name) {
  const entry = await loadGuildTemplates(guildId);
  return entry.templates.get(name) || null;
}

function applyPlaceholders(text, placeholders = {}) {
  if (!text || typeof text !== 'string') return text;
  let out = String(text);
  const map = {
    '{date}': new Date().toLocaleString(),
    ...placeholders,
  };
  Object.entries(map).forEach(([key, val]) => {
    out = out.split(key).join(val === undefined || val === null ? '' : String(val));
  });
  return out;
}

export async function renderEmbed(guildId, name, placeholders = {}) {
  const tpl = await getEmbed(guildId, name);
  if (!tpl) return null;
  // shallow clone
  const res = {};
  if (tpl.title) res.title = applyPlaceholders(tpl.title, placeholders);
  if (tpl.description) res.description = applyPlaceholders(tpl.description, placeholders);
  if (tpl.color) res.color = tpl.color;
  if (tpl.thumbnailUrl) res.thumbnail = { url: applyPlaceholders(tpl.thumbnailUrl, placeholders) };
  if (tpl.imageUrl) res.image = { url: applyPlaceholders(tpl.imageUrl, placeholders) };
  if (tpl.footer) res.footer = { text: applyPlaceholders(tpl.footer.text || '', placeholders) };
  if (tpl.fields && Array.isArray(tpl.fields)) {
    res.fields = tpl.fields.map(f => ({ name: applyPlaceholders(f.name, placeholders), value: applyPlaceholders(f.value, placeholders), inline: !!f.inline }));
  }
  return res;
}

export default {
  createEmbed,
  updateEmbed,
  deleteEmbed,
  getEmbed,
  renderEmbed,
  _internal: { CACHE, HARD_LIMIT },
};
