import {
    processVerification, sendVerificationMessage, sendWelcomeMessage, assignAutoRoles,
    handleEnable, handleDisable, handleView, handleStats,
    handleModeSet, handleTriggerWordSet,
    handleSecuritySet,
    handleRoleSetVerify, handleBypassRoleAdd, handleBypassRoleRemove,
    handleLogsEnable, handleLogsDisable,
    handleMessageSet,
    handleEmbedEdit, handleEmbedPreview,
    handleGatewayLock, handleGatewayUnlock,
} from './actions.js';
import { checkPermission } from './checker.js';
import { logger } from '../../core/logger.js';
import { getGuildConfig } from '../../core/database.js';
import { ensureDefaultConfig } from './config.schema.js';

export default {
    name: 'gateway',
    version: '2.0.0',
    async init(client) {
        logger.info('Gateway verification module initialized');

        // ====================================================================
        // BUTTON VERIFICATION HANDLER
        // ====================================================================
        client.on('interactionCreate', async (interaction) => {
            try {
                if (!interaction.isButton()) return;
                const customId = interaction.customId || '';
                if (!customId.startsWith('gateway_verify')) return;

                const guild = interaction.guild;
                if (!guild) return;

                const guildConfig = await getGuildConfig(guild.id);
                const gateway = ensureDefaultConfig(guildConfig.modules?.gateway || {});

                if (!gateway.enabled) return;
                if (gateway.mode?.type !== 'button') return;

                const result = await processVerification({
                    guild,
                    user: interaction.user,
                    channel: interaction.channel,
                    config: gateway,
                    mode: 'button',
                    messageObject: interaction.message,
                });
                await sendVerificationMessage(interaction.channel, interaction.user, result, gateway, interaction.message);
                await interaction.reply({ content: '✅ Verification processed.', ephemeral: true }).catch(() => null);
            } catch (err) {
                logger.error(`Button handler error: ${err.message}`);
            }
        });

        // ====================================================================
        // REACTION VERIFICATION HANDLER
        // ====================================================================
        client.on('messageReactionAdd', async (reaction, user) => {
            try {
                if (user.bot) return;
                const message = reaction.message;
                if (!message || !message.guild) return;

                const guildConfig = await getGuildConfig(message.guild.id);
                const gateway = ensureDefaultConfig(guildConfig.modules?.gateway || {});

                if (!gateway.enabled || gateway.mode?.type !== 'reaction') return;

                const emoji = gateway.mode?.reactionEmoji;
                if (!emoji) return;

                const reacted = reaction.emoji?.name === emoji || reaction.emoji?.toString() === emoji;
                if (!reacted) return;

                if (gateway.channelId && gateway.channelId !== message.channelId) return;

                const result = await processVerification({
                    guild: message.guild,
                    user,
                    channel: message.channel,
                    config: gateway,
                    mode: 'reaction',
                    messageObject: message,
                });
                await sendVerificationMessage(message.channel, user, result, gateway, message);
            } catch (err) {
                logger.error(`Reaction handler error: ${err.message}`);
            }
        });

        // ====================================================================
        // TRIGGER WORD VERIFICATION HANDLER
        // ====================================================================
        client.on('messageCreate', async (message) => {
            try {
                if (message.author.bot || !message.guild) return;

                const guildConfig = await getGuildConfig(message.guild.id);
                const gateway = ensureDefaultConfig(guildConfig.modules?.gateway || {});

                if (!gateway.enabled || gateway.mode?.type !== 'trigger') return;

                const triggerWord = gateway.mode?.triggerWord;
                if (!triggerWord) return;

                if (gateway.channelId && gateway.channelId !== message.channelId) return;

                const hasTriggered = message.content.toLowerCase().includes(triggerWord.toLowerCase());
                if (!hasTriggered) return;

                const result = await processVerification({
                    guild: message.guild,
                    user: message.author,
                    channel: message.channel,
                    config: gateway,
                    mode: 'trigger',
                    messageObject: message,
                });
                await sendVerificationMessage(message.channel, message.author, result, gateway, message);
            } catch (err) {
                logger.error(`Trigger word handler error: ${err.message}`);
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

        // ====================================================================
        // ADMIN MANAGEMENT COMMANDS
        // ====================================================================
        if (!subcommandGroup) {
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
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
            return;
        }

        // ====================================================================
        // SUBCOMMAND GROUPS
        // ====================================================================
        switch (subcommandGroup) {
            // /gateway mode set
            case 'mode': {
                if (subcommand === 'set') {
                    const mode = interaction.options.getString('mode');
                    await handleModeSet(interaction, mode);
                }
                break;
            }

            // /gateway security set
            case 'security': {
                if (subcommand === 'set') {
                    const field = interaction.options.getString('field');
                    const value = interaction.options.getNumber('value') || interaction.options.getString('value');
                    await handleSecuritySet(interaction, field, value);
                }
                break;
            }

            // /gateway role ...
            case 'role': {
                if (subcommand === 'set_verify') {
                    const role = interaction.options.getRole('role');
                    await handleRoleSetVerify(interaction, role);
                } else if (subcommand === 'bypass_add') {
                    const role = interaction.options.getRole('role');
                    await handleBypassRoleAdd(interaction, role);
                } else if (subcommand === 'bypass_remove') {
                    const role = interaction.options.getRole('role');
                    await handleBypassRoleRemove(interaction, role);
                }
                break;
            }

            // /gateway logs ...
            case 'logs': {
                if (subcommand === 'enable') {
                    const channel = interaction.options.getChannel('channel');
                    await handleLogsEnable(interaction, channel?.id);
                } else if (subcommand === 'disable') {
                    await handleLogsDisable(interaction);
                }
                break;
            }

            // /gateway message set
            case 'message': {
                if (subcommand === 'set') {
                    const text = interaction.options.getString('text');
                    await handleMessageSet(interaction, text);
                }
                break;
            }

            // /gateway embed ...
            case 'embed': {
                if (subcommand === 'edit') {
                    const type = interaction.options.getString('type');
                    const field = interaction.options.getString('field');
                    const value = interaction.options.getString('value');
                    await handleEmbedEdit(interaction, type, field, value);
                } else if (subcommand === 'preview') {
                    const type = interaction.options.getString('type');
                    await handleEmbedPreview(interaction, type);
                }
                break;
            }

            // /gateway lock/unlock
            case 'lock': {
                if (subcommand === 'lock') {
                    const minutes = interaction.options.getNumber('minutes') || 10;
                    const reason = interaction.options.getString('reason') || 'Manually locked';
                    await handleGatewayLock(interaction, minutes, reason);
                } else if (subcommand === 'unlock') {
                    await handleGatewayUnlock(interaction);
                }
                break;
            }

            default:
                await interaction.reply({ content: 'Unknown subcommand group.', ephemeral: true });
        }
    },

    // ====================================================================
    // PUBLIC USER SLASH COMMAND: /verify
    // ====================================================================
    async handleVerifyCommand(interaction) {
        try {
            const guild = interaction.guild;
            if (!guild) {
                await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
                return;
            }

            const guildConfig = await getGuildConfig(guild.id);
            const gateway = ensureDefaultConfig(guildConfig.modules?.gateway || {});

            if (!gateway.enabled) {
                await interaction.reply({ content: 'Gateway verification is not enabled.', ephemeral: true });
                return;
            }

            if (gateway.mode?.type !== 'slash') {
                await interaction.reply({ content: 'Slash verification is not available. Check /gateway for your server\'s verification method.', ephemeral: true });
                return;
            }

            const result = await processVerification({
                guild,
                user: interaction.user,
                channel: interaction.channel,
                config: gateway,
                mode: 'slash',
            });

            await sendVerificationMessage(interaction.channel, interaction.user, result, gateway);
            await interaction.reply({ content: '✅ Verification processed.', ephemeral: true }).catch(() => null);
        } catch (err) {
            logger.error(`/verify command error: ${err.message}`);
            await interaction.reply({ content: 'An error occurred during verification.', ephemeral: true }).catch(() => null);
        }
    },

    // ====================================================================
    // PUBLIC EXPORTS FOR EVENT HANDLERS
    // ====================================================================
    processVerification,
    sendVerificationMessage,
    sendWelcomeMessage,
    assignAutoRoles,
};
