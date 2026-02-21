import { logger } from '../../core/logger.js';
import embedEngine from '../../core/embedEngine.js';
import { getGuildConfig } from '../../core/database.js';

export default {
    name: 'embedTemplates',
    init() {
        logger.info('Embed Templates module restored and initialized');
    },
    async handleSubcommand(interaction) {
        if (!interaction.inGuild() || !interaction.guildId) {
            return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        try {
            if (sub === 'create') {
                const name = interaction.options.getString('name', true);
                const title = interaction.options.getString('title');
                const description = interaction.options.getString('description');
                const color = interaction.options.getNumber('color');
                const data = { title, description };
                if (typeof color === 'number') data.color = color;
                await embedEngine.createEmbed(guildId, name, data);
                return interaction.reply({ content: `Template '${name}' created.`, ephemeral: true });
            }

            if (sub === 'edit') {
                const name = interaction.options.getString('name', true);
                const title = interaction.options.getString('title');
                const description = interaction.options.getString('description');
                const color = interaction.options.getNumber('color');
                const data = { title, description };
                if (typeof color === 'number') data.color = color;
                await embedEngine.updateEmbed(guildId, name, data);
                return interaction.reply({ content: `Template '${name}' updated.`, ephemeral: true });
            }

            if (sub === 'delete') {
                const name = interaction.options.getString('name', true);
                await embedEngine.deleteEmbed(guildId, name);
                return interaction.reply({ content: `Template '${name}' deleted.`, ephemeral: true });
            }

            if (sub === 'list') {
                const cfg = await getGuildConfig(guildId);
                const templates = (cfg && cfg.modules && cfg.modules.embed && cfg.modules.embed.templates) ? Object.keys(cfg.modules.embed.templates) : [];
                if (!templates.length) return interaction.reply({ content: 'No templates configured.', ephemeral: true });
                return interaction.reply({ content: `Templates: ${templates.join(', ')}`, ephemeral: true });
            }

            if (sub === 'preview') {
                const name = interaction.options.getString('name', true);
                const rendered = await embedEngine.renderEmbed(guildId, name);
                if (!rendered) return interaction.reply({ content: 'Template not found.', ephemeral: true });
                return interaction.reply({ embeds: [rendered], ephemeral: true });
            }

            return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
        } catch (err) {
            logger.error(`embedTemplates.handleSubcommand error: ${err.message}`);
            return interaction.reply({ content: `Operation failed: ${err.message}`, ephemeral: true });
        }
    }
};
