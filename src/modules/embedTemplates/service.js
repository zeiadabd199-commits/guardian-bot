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

export async function getTemplate(guildId, name) {
  try {
    const doc = await Model.findOne({ guildId, name }).lean();
    return doc || null;
  } catch (err) {
    logger.error(`embedTemplates.getTemplate error: ${err.message}`);
    return null;
  }
}

export async function listTemplates(guildId) {
  try {
    const docs = await Model.find({ guildId }).lean();
    return docs || [];
  } catch (err) {
    logger.error(`embedTemplates.listTemplates error: ${err.message}`);
    return [];
  }
}

export async function createTemplate(guildId, name, data) {
  try {
    const count = await Model.countDocuments({ guildId });
    if (count >= MAX_PER_GUILD) throw new Error('Maximum templates reached for guild');
    const doc = new Model({ guildId, name, ...data });
    await doc.save();
    return doc.toObject();
  } catch (err) {
    logger.error(`embedTemplates.createTemplate error: ${err.message}`);
    throw err;
  }
}

export async function updateTemplate(guildId, name, data) {
  try {
    const doc = await Model.findOneAndUpdate({ guildId, name }, { $set: { ...data } }, { new: true });
    if (!doc) throw new Error('Template not found');
    return doc.toObject();
  } catch (err) {
    logger.error(`embedTemplates.updateTemplate error: ${err.message}`);
    throw err;
  }
}

export async function deleteTemplate(guildId, name) {
  try {
    const res = await Model.findOneAndDelete({ guildId, name });
    if (!res) throw new Error('Template not found');
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
    const placeholders = Object.assign({}, variables);
    // support {user}, {guild}, {channel}, {date}
    const res = {};
    if (tpl.title) res.title = applyPlaceholders(tpl.title, placeholders);
    if (tpl.description) res.description = applyPlaceholders(tpl.description, placeholders);
    if (tpl.color) res.color = tpl.color;
    if (tpl.thumbnail) res.thumbnail = { url: applyPlaceholders(tpl.thumbnail, placeholders) };
    if (tpl.image) res.image = { url: applyPlaceholders(tpl.image, placeholders) };
    if (tpl.footer) res.footer = { text: applyPlaceholders(tpl.footer.text || '', placeholders) };
    if (tpl.author) res.author = { name: applyPlaceholders(tpl.author.name || '', placeholders) };
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
