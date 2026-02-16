import { handleEnable, handleDisable, handleView, handleMessageSet, handleEmojiSet, handleEmbedToggle, processIntroduction, sendIntroductionMessage, handleTriggerSet, handleRoleSet, handleChannelSet, handleMessageKeySet } from './actions.js';
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
                    // support message.set (legacy) and message.<key> new structure
                    if (subcommand === 'set') {
                        const text = interaction.options.getString('text');
                        await handleMessageSet(interaction, text);
                    } else if (['success', 'error', 'already', 'dm'].includes(subcommand)) {
                        const text = interaction.options.getString('text');
                        await handleMessageKeySet(interaction, subcommand, text);
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
                case 'trigger': {
                    if (subcommand === 'set') {
                        const word = interaction.options.getString('word');
                        await handleTriggerSet(interaction, word);
                    }
                    break;
                }
                case 'role': {
                    // subcommands: set_verify, set_pending, set_remove
                    if (subcommand === 'set_verify') {
                        const role = interaction.options.getRole('verify_role');
                        await handleRoleSet(interaction, 'verify', role);
                    } else if (subcommand === 'set_pending') {
                        const role = interaction.options.getRole('pending_role');
                        await handleRoleSet(interaction, 'pending', role);
                    } else if (subcommand === 'set_remove') {
                        const role = interaction.options.getRole('remove_role');
                        await handleRoleSet(interaction, 'remove', role);
                    }
                    break;
                }
                case 'channel': {
                    if (subcommand === 'set') {
                        const channel = interaction.options.getChannel('verify_channel');
                        await handleChannelSet(interaction, channel);
                    }
                    break;
                }
                default:
                    await interaction.reply({ content: 'Unknown subcommand group.', ephemeral: true });
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
