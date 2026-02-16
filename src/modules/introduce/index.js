import { handleEnable, handleDisable, handleView, handleMessageSet, handleEmojiSet, handleEmbedToggle, processIntroduction, sendIntroductionMessage } from './actions.js';
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
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        
        const hasAdmin = await checkPermission(interaction);
        if (!hasAdmin) {
            await interaction.reply({
                content: 'You need Administrator permission to use this command.',
                ephemeral: true,
            });
            return;
        }

        // Handle subcommand groups
        if (subcommandGroup) {
            switch (subcommandGroup) {
                case 'message': {
                    if (subcommand === 'set') {
                        const text = interaction.options.getString('text');
                        await handleMessageSet(interaction, text);
                    }
                    break;
                }
                case 'emoji': {
                    if (subcommand === 'set') {
                        const emoji = interaction.options.getString('emoji');
                        await handleEmojiSet(interaction, emoji);
                    }
                    break;
                }
                case 'embed': {
                    if (subcommand === 'toggle') {
                        const enabled = interaction.options.getBoolean('enabled');
                        await handleEmbedToggle(interaction, enabled);
                    }
                    break;
                }
                default:
                    await interaction.reply({
                        content: 'Unknown subcommand group.',
                        ephemeral: true,
                    });
            }
        } else {
            // Handle regular subcommands
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
        }
    },
    // Export functions for external use (like messageCreate event)
    processIntroduction,
    sendIntroductionMessage,
};
