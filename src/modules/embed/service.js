import embedEngine from '../../core/embedEngine.js';

export async function createTemplate(guildId, name, data) {
  return embedEngine.createEmbed(guildId, name, data);
}

export async function updateTemplate(guildId, name, data) {
  return embedEngine.updateEmbed(guildId, name, data);
}

export async function deleteTemplate(guildId, name) {
  return embedEngine.deleteEmbed(guildId, name);
}

export async function getTemplate(guildId, name) {
  return embedEngine.getEmbed(guildId, name);
}

export async function renderTemplate(guildId, name, placeholders) {
  return embedEngine.renderEmbed(guildId, name, placeholders);
}

export default {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplate,
  renderTemplate,
};
