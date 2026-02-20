import { logger } from '../../core/logger.js';
import { checkAdminPermission } from '../../core/permissions.js';
import * as svc from './service.js';
import { ensureDefaultConfig } from './config.schema.js';
import { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } from 'discord.js';

export default {
  name: 'embed',
  version: '1.0.0',
  async init(client) {
    logger.info('Embed module initialized');
    // nothing on init for now
    // Modal submit handler for embed edit
    client.on('interactionCreate', async (interaction) => {
      try {
        if (!interaction.isModalSubmit()) return;
        const id = interaction.customId || '';
        if (!id.startsWith('embed_edit:')) return;
        const parts = id.split(':');
        // customId format: embed_edit:<guildId>:<name>
        const guildId = parts[1];
        const name = parts.slice(2).join(':');
        if (!guildId || !name) return;

        const isAdmin = await checkAdminPermission(interaction);
        if (!isAdmin) return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });

        const title = interaction.fields.getTextInputValue('embed_title') || undefined;
        const description = interaction.fields.getTextInputValue('embed_description') || undefined;
        const colorRaw = interaction.fields.getTextInputValue('embed_color') || undefined;
        const footer = interaction.fields.getTextInputValue('embed_footer') || undefined;
        const image = interaction.fields.getTextInputValue('embed_image') || undefined;

        const color = colorRaw ? Number(colorRaw) : undefined;

        const template = { title, description, color, footer: footer ? { text: footer } : undefined };
        if (image) template.imageUrl = image;

        await svc.updateTemplate(guildId, name, template);
        await interaction.reply({ content: `Template ${name} updated via Modal.`, ephemeral: true });
      } catch (err) {
        logger.error(`embed modal submit error: ${err.message}`);
        try { await interaction.reply({ content: `Error: ${err.message}`, ephemeral: true }); } catch (e) {}
      }
    });
  },
  async handleSubcommand(interaction) {
    const sub = interaction.options.getSubcommand();
    const isAdmin = await checkAdminPermission(interaction);
    if (!isAdmin) return interaction.reply({ content: 'Administrator permission required.', ephemeral: true });

    const guildId = interaction.guildId;

    try {
      switch (sub) {
        case 'create': {
          const name = interaction.options.getString('name');
          const title = interaction.options.getString('title');
          const description = interaction.options.getString('description');
          const color = interaction.options.getNumber('color') || undefined;
          const template = { title, description, color };
          await svc.createTemplate(guildId, name, template);
          await interaction.reply({ content: `Template ${name} created.`, ephemeral: true });
          break;
        }
        case 'edit': {
          const name = interaction.options.getString('name');
          // open a Modal for rich editing
          const tpl = await svc.getTemplate(guildId, name);
          if (!tpl) return interaction.reply({ content: `Template ${name} not found.`, ephemeral: true });

          const modal = new ModalBuilder()
            .setCustomId(`embed_edit:${guildId}:${name}`)
            .setTitle(`Edit Template: ${name}`);

          const titleInput = new TextInputBuilder().setCustomId('embed_title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(false).setValue(tpl.title || '');
          const descInput = new TextInputBuilder().setCustomId('embed_description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(tpl.description || '');
          const colorInput = new TextInputBuilder().setCustomId('embed_color').setLabel('Color (integer)').setStyle(TextInputStyle.Short).setRequired(false).setValue(tpl.color ? String(tpl.color) : '');
          const footerInput = new TextInputBuilder().setCustomId('embed_footer').setLabel('Footer text').setStyle(TextInputStyle.Short).setRequired(false).setValue((tpl.footer && tpl.footer.text) || '');
          const imageInput = new TextInputBuilder().setCustomId('embed_image').setLabel('Image URL').setStyle(TextInputStyle.Short).setRequired(false).setValue(tpl.imageUrl || tpl.image?.url || '');

          modal.addComponents(new ActionRowBuilder().addComponents(titleInput));
          modal.addComponents(new ActionRowBuilder().addComponents(descInput));
          modal.addComponents(new ActionRowBuilder().addComponents(colorInput));
          modal.addComponents(new ActionRowBuilder().addComponents(footerInput));
          modal.addComponents(new ActionRowBuilder().addComponents(imageInput));

          await interaction.showModal(modal);
          break;
        }
        case 'delete': {
          const name = interaction.options.getString('name');
          await svc.deleteTemplate(guildId, name);
          await interaction.reply({ content: `Template ${name} deleted.`, ephemeral: true });
          break;
        }
        case 'list': {
          const cfgModule = (await import('../../core/database.js')).getGuildConfig;
          const gcfg = await (await import('../../core/database.js')).getGuildConfig(guildId);
          const list = Object.keys((gcfg.modules && gcfg.modules.embed && gcfg.modules.embed.templates) || {});
          await interaction.reply({ content: `Templates: ${list.join(', ') || 'none'}`, ephemeral: true });
          break;
        }
        case 'preview': {
          const name = interaction.options.getString('name');
          const tpl = await svc.getTemplate(guildId, name);
          if (!tpl) return interaction.reply({ content: `Template ${name} not found.`, ephemeral: true });
          const embed = await svc.renderTemplate(guildId, name, {
            '{user}': interaction.user.username,
            '{mention}': `<@${interaction.user.id}>`,
            '{server}': interaction.guild?.name || '',
            '{date}': new Date().toLocaleString(),
          });
          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }
        default:
          await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
      }
    } catch (err) {
      logger.error(`embed module error: ${err.message}`);
      await interaction.reply({ content: `Error: ${err.message}`, ephemeral: true });
    }
  }
};
