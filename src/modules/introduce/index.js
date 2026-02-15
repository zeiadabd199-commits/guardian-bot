import { handleEnable, handleDisable, handleView } from './actions.js';
import { isModuleEnabled, checkPermission } from './checker.js';
import { logger } from '../../core/logger.js';

export default {
    name: 'introduce',
    version: '1.0.0',
    async init(client) {
        logger.info('Introduce module initialized');
    },
    async handleSubcommand(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        const hasAdmin = await checkPermission(interaction);
        if (!hasAdmin) {
            await interaction.reply({
                content: 'You need Administrator permission to use this command.',
                ephemeral: true,
            });
            return;
        }

        switch (subcommand) {
            case 'enable': {
                const channel = interaction.options.getChannel('channel');
                await handleEnable(interaction, channel?.id);
                break;
            }
            case 'disable': {
                await handleDisable(interaction);
                break;
            }
            case 'view': {
                await handleView(interaction);
                break;
            }
            default:
                await interaction.reply({
                    content: 'Unknown subcommand.',
                    ephemeral: true,
                });
        }
    },
};
