import mongoose from 'mongoose';
import { logger } from '../../core/logger.js';

const { Schema } = mongoose;

const embedTemplateSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  title: { type: String, default: null },
  description: { type: String, default: null },
  color: { type: Number, default: null },
  footer: { type: Schema.Types.Mixed, default: null },
  image: { type: String, default: null },
  thumbnail: { type: String, default: null },
  author: { type: Schema.Types.Mixed, default: null },
  timestamp: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

embedTemplateSchema.index({ guildId: 1, name: 1 }, { unique: true });

let Model;
try {
  Model = mongoose.model('EmbedTemplate');
} catch (e) {
  Model = mongoose.model('EmbedTemplate', embedTemplateSchema, 'embed_templates');
}

const MAX_PER_GUILD = 30;

function applyPlaceholders(text, placeholders = {}) {
  if (!text) return text;
  let out = String(text);
  const map = { '{date}': new Date().toLocaleString(), ...placeholders };
  Object.entries(map).forEach(([k, v]) => { out = out.split(k).join(v === undefined || v === null ? '' : String(v)); });
  return out;
}

function hexToInt(col) {
  if (col === null || col === undefined) return null;
  if (typeof col === 'number') return col;
  let s = String(col).trim();
  if (s.startsWith('#')) s = s.slice(1);
  // parse hex, fallback to NaN
  const n = parseInt(s, 16);
  return Number.isNaN(n) ? null : n;
}

export async function getTemplate(guildId, name) {
  try {
    const doc = await Model.findOne({ guildId, name, _deleted: { $ne: true } }).lean();
    return doc || null;
  } catch (err) {
    logger.error(`embedTemplates.getTemplate error: ${err.message}`);
    return null;
  }
}

export async function listTemplates(guildId) {
  try {
    const docs = await Model.find({ guildId, _deleted: { $ne: true } }).lean();
    return docs || [];
  } catch (err) {
    logger.error(`embedTemplates.listTemplates error: ${err.message}`);
    return [];
  }
}

export async function createTemplate(guildId, name, data) {
  try {
    const count = await Model.countDocuments({ guildId });
    if (count >= MAX_PER_GUILD) throw new Error('Embed template limit (30) reached');
    const payload = Object.assign({}, data);
    if (payload.color) payload.color = hexToInt(payload.color);
    const doc = new Model({ guildId, name, ...payload });
    await doc.save();
    return doc.toObject();
  } catch (err) {
    logger.error(`embedTemplates.createTemplate error: ${err.message}`);
    throw err;
  }
}

export async function updateTemplate(guildId, name, data) {
  try {
    const payload = Object.assign({}, data);
    if (payload.color) payload.color = hexToInt(payload.color);
    const doc = await Model.findOneAndUpdate({ guildId, name }, { $set: { ...payload } }, { new: true });
    if (!doc) throw new Error('Template not found');
    return doc.toObject();
  } catch (err) {
    logger.error(`embedTemplates.updateTemplate error: ${err.message}`);
    throw err;
  }
}

export async function deleteTemplate(guildId, name) {
  try {
    const res = await Model.updateOne({ guildId, name, _deleted: { $ne: true } }, { $set: { _deleted: true } });
    if (!res || res.matchedCount === 0) throw new Error('Template not found');
    return true;
  } catch (err) {
    logger.error(`embedTemplates.deleteTemplate error: ${err.message}`);
    throw err;
  }
}

export async function renderTemplate(guildId, name, variables = {}) {
  try {
    const tpl = await getTemplate(guildId, name);
    if (!tpl) return null;
    // Build a simple placeholder map from provided variables (user, guild, channel, date)
    const map = {};
    if (variables.user) map['{user}'] = variables.user.username || variables.user.id || '';
    if (variables.user) map['{mention}'] = `<@${variables.user.id}>`;
    if (variables.guild) map['{guild}'] = variables.guild.name || '';
    if (variables.channel) map['{channel}'] = variables.channel.name || variables.channel.id || '';
    map['{date}'] = variables.date ? (variables.date.toLocaleString ? variables.date.toLocaleString() : String(variables.date)) : new Date().toLocaleString();

    const res = {};
    if (tpl.title) res.title = applyPlaceholders(tpl.title, map);
    if (tpl.description) res.description = applyPlaceholders(tpl.description, map);
    // ensure color is integer
    const colorInt = hexToInt(tpl.color);
    if (colorInt !== null) res.color = colorInt;
    if (tpl.thumbnail) res.thumbnail = { url: applyPlaceholders(tpl.thumbnail, map) };
    if (tpl.image) res.image = { url: applyPlaceholders(tpl.image, map) };
    if (tpl.footer) res.footer = { text: applyPlaceholders(tpl.footer.text || '', map) };
    if (tpl.author) res.author = { name: applyPlaceholders(tpl.author.name || '', map) };
    if (tpl.timestamp) res.timestamp = new Date();
    return res;
  } catch (err) {
    logger.error(`embedTemplates.renderTemplate error: ${err.message}`);
    return null;
  }
}

export default {
  getTemplate,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  renderTemplate,
};
