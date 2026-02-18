import { logger } from '../../core/logger.js';
import { checkAdminPermission } from '../../core/permissions.js';
import * as svc from './service.js';
import { ensureDefaultConfig } from './config.schema.js';

export default {
  name: 'embed',
  version: '1.0.0',
  async init(client) {
    logger.info('Embed module initialized');
    // nothing on init for now
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
          const title = interaction.options.getString('title');
          const description = interaction.options.getString('description');
          const color = interaction.options.getNumber('color') || undefined;
          const template = { title, description, color };
          await svc.updateTemplate(guildId, name, template);
          await interaction.reply({ content: `Template ${name} updated.`, ephemeral: true });
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
