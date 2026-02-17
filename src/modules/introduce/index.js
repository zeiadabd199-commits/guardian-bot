import { handleEnable, handleDisable, handleView, handleMessageSet, handleEmojiSet, handleEmbedToggle, processIntroduction, sendIntroductionMessage, handleStats } from './actions.js';
import { isModuleEnabled, checkPermission } from './checker.js';
import { logger } from '../../core/logger.js';

export default {
    name: 'introduce',
    version: '1.0.0',
    async init(client) {
        logger.info('Introduce module initialized');

        // Register button and reaction handlers dynamically
        client.on('interactionCreate', async (interaction) => {
            try {
                if (!interaction.isButton()) return;
                const custom = interaction.customId || '';
                if (!custom.startsWith('gateway_verify')) return;

                const guild = interaction.guild;
                if (!guild) return;

                const guildConfig = await (await import('../../core/database.js')).getGuildConfig(guild.id);
                const introduce = (await import('./config.schema.js')).ensureDefaultConfig(guildConfig.modules?.introduce || {});

                // Process verification
                const result = await this.processIntroduction({ guild, user: interaction.user, channel: interaction.channel, messageObject: interaction.message, config: introduce });
                await this.sendIntroductionMessage(interaction.channel, interaction.user, result, introduce, interaction.message);
                await interaction.reply({ content: 'Verification attempted.', ephemeral: true });
            } catch (err) {
                logger.error(`Button handler error: ${err.message}`);
            }
        });

        client.on('messageReactionAdd', async (reaction, user) => {
            try {
                if (user.bot) return;
                const message = reaction.message;
                if (!message || !message.guild) return;

                const guildConfig = await (await import('../../core/database.js')).getGuildConfig(message.guild.id);
                const introduce = (await import('./config.schema.js')).ensureDefaultConfig(guildConfig.modules?.introduce || {});

                if (introduce.mode?.type !== 'reaction') return;
                const emoji = introduce.mode?.reactionEmoji;
                if (!emoji) return;
                // Compare unicode or name
                const reacted = reaction.emoji?.name === emoji || reaction.emoji?.toString() === emoji;
                if (!reacted) return;

                // If channel lock configured, enforce
                if (introduce.channelId && introduce.channelId !== message.channelId) return;

                const member = await message.guild.members.fetch(user.id).catch(() => null);
                const result = await this.processIntroduction({ guild: message.guild, user, channel: message.channel, messageObject: message, config: introduce });
                await this.sendIntroductionMessage(message.channel, user, result, introduce, message);
            } catch (err) {
                logger.error(`Reaction handler error: ${err.message}`);
            }
        });
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
                    } else {
                        await interaction.reply({ content: 'Unknown message subcommand.', ephemeral: true });
                    }
                    break;
                }
                case 'emoji': {
                    if (subcommand === 'set') {
                        const emoji = interaction.options.getString('emoji');
                        await handleEmojiSet(interaction, emoji);
                    } else {
                        await interaction.reply({ content: 'Unknown emoji subcommand.', ephemeral: true });
                    }
                    break;
                }
                case 'embed': {
                    if (subcommand === 'toggle') {
                        const enabled = interaction.options.getBoolean('enabled');
                        await handleEmbedToggle(interaction, enabled);
                    } else {
                        await interaction.reply({ content: 'Unknown embed subcommand.', ephemeral: true });
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
                case 'stats': {
                    await handleStats(interaction);
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
    // Export functions for external use (like messageCreate event) and new handlers
    processIntroduction,
    sendIntroductionMessage,
    handleStats,
};
