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
                    import {
                        processVerification,
                        sendVerificationMessage,
                        sendWelcomeMessage,
                        assignAutoRoles,
                        handleEnable,
                        handleDisable,
                        handleView,
                        handleStats,
                        handleSystemCreate,
                        handleSystemDelete,
                        handleSystemList,
                        handleSystemConfigure,
                        handleGatewayLock,
                        handleGatewayUnlock,
                    } from './actions.js';
                    import { checkPermission } from './checker.js';
                    import { logger } from '../../core/logger.js';
                    import { getGuildConfig } from '../../core/database.js';
                    import { ensureDefaultConfig } from './config.schema.js';

                    export default {
                        name: 'gateway',
                        version: '3.0.0',
                        async init(client) {
                            logger.info('Gateway verification module initialized (systems)');

                            // BUTTON HANDLER
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

                                    // customId format: gateway_verify[:systemId]
                                    const parts = customId.split(':');
                                    const systemId = parts[1] || null;

                                    const system = (systemId ? gateway.systems.find(s => s.id === systemId) : null) || gateway.systems.find(s => s.enabled && s.type === 'button');
                                    if (!system) return;

                                    if (system.channelId && system.channelId !== interaction.channelId) return;

                                    const result = await processVerification({
                                        guild,
                                        user: interaction.user,
                                        channel: interaction.channel,
                                        config: gateway,
                                        system,
                                        mode: 'button',
                                        messageObject: interaction.message,
                                    });
                                    await sendVerificationMessage(interaction.channel, interaction.user, result, gateway, interaction.message, system);
                                    await interaction.reply({ content: '✅ Verification processed.', ephemeral: true }).catch(() => null);
                                } catch (err) {
                                    logger.error(`Button handler error: ${err.message}`);
                                }
                            });

                            // REACTION HANDLER
                            client.on('messageReactionAdd', async (reaction, user) => {
                                try {
                                    if (user.bot) return;
                                    const message = reaction.message;
                                    if (!message || !message.guild) return;

                                    const guildConfig = await getGuildConfig(message.guild.id);
                                    const gateway = ensureDefaultConfig(guildConfig.modules?.gateway || {});
                                    if (!gateway.enabled) return;

                                    // find matching reaction system
                                    const system = gateway.systems.find(s => s.enabled && s.type === 'reaction' && (s.reactionEmoji === reaction.emoji?.name || s.reactionEmoji === reaction.emoji?.toString()) && (!s.channelId || s.channelId === message.channelId));
                                    if (!system) return;

                                    const result = await processVerification({
                                        guild: message.guild,
                                        user,
                                        channel: message.channel,
                                        config: gateway,
                                        system,
                                        mode: 'reaction',
                                        messageObject: message,
                                    });
                                    await sendVerificationMessage(message.channel, user, result, gateway, message, system);
                                } catch (err) {
                                    logger.error(`Reaction handler error: ${err.message}`);
                                }
                            });

                            // TEXT/TRIGGER HANDLER
                            client.on('messageCreate', async (message) => {
                                try {
                                    if (message.author.bot || !message.guild) return;

                                    const guildConfig = await getGuildConfig(message.guild.id);
                                    const gateway = ensureDefaultConfig(guildConfig.modules?.gateway || {});
                                    if (!gateway.enabled) return;

                                    // find any trigger/text system that matches
                                    const lc = message.content.toLowerCase();
                                    const system = gateway.systems.find(s => s.enabled && (s.type === 'text' || s.type === 'trigger') && s.triggerText && lc.includes(s.triggerText.toLowerCase()) && (!s.channelId || s.channelId === message.channelId));
                                    if (!system) return;

                                    const result = await processVerification({
                                        guild: message.guild,
                                        user: message.author,
                                        channel: message.channel,
                                        config: gateway,
                                        system,
                                        mode: 'trigger',
                                        messageObject: message,
                                    });
                                    await sendVerificationMessage(message.channel, message.author, result, gateway, message, system);
                                } catch (err) {
                                    logger.error(`Trigger handler error: ${err.message}`);
                                }
                            });
                        },

                        async handleSubcommand(interaction) {
                            const subcommand = interaction.options.getSubcommand();
                            const subcommandGroup = interaction.options.getSubcommandGroup(false);

                            const hasAdmin = await checkPermission(interaction);
                            if (!hasAdmin) {
                                await interaction.reply({ content: 'You need Administrator permission to use this command.', ephemeral: true });
                                return;
                            }

                            // top-level admin commands
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

                            // system management group
                            if (subcommandGroup === 'system') {
                                switch (subcommand) {
                                    case 'create': {
                                        const type = interaction.options.getString('type');
                                        const channel = interaction.options.getChannel('channel');
                                        const trigger = interaction.options.getString('trigger');
                                        const emoji = interaction.options.getString('emoji');
                                        await handleSystemCreate(interaction, { type, channelId: channel?.id || null, triggerText: trigger || null, reactionEmoji: emoji || null });
                                        break;
                                    }
                                    case 'delete': {
                                        const id = interaction.options.getString('id');
                                        await handleSystemDelete(interaction, id);
                                        break;
                                    }
                                    case 'list': {
                                        await handleSystemList(interaction);
                                        break;
                                    }
                                    case 'configure': {
                                        const id = interaction.options.getString('id');
                                        const field = interaction.options.getString('field');
                                        const value = interaction.options.getString('value');
                                        await handleSystemConfigure(interaction, id, field, value);
                                        break;
                                    }
                                    default:
                                        await interaction.reply({ content: 'Unknown system subcommand.', ephemeral: true });
                                }
                                return;
                            }

                            // other groups: lock
                            if (subcommandGroup === 'lock') {
                                if (subcommand === 'lock') {
                                    const minutes = interaction.options.getNumber('minutes') || 10;
                                    const reason = interaction.options.getString('reason') || 'Manually locked';
                                    await handleGatewayLock(interaction, minutes, reason);
                                } else if (subcommand === 'unlock') {
                                    await handleGatewayUnlock(interaction);
                                }
                                return;
                            }

                            await interaction.reply({ content: 'Unknown subcommand group.', ephemeral: true });
                        },

                        async handleVerifyCommand(interaction) {
                            try {
                                const guild = interaction.guild;
                                if (!guild) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });

                                const guildConfig = await getGuildConfig(guild.id);
                                const gateway = ensureDefaultConfig(guildConfig.modules?.gateway || {});
                                if (!gateway.enabled) return interaction.reply({ content: 'Gateway verification is not enabled.', ephemeral: true });

                                // find slash system
                                const system = gateway.systems.find(s => s.enabled && s.type === 'slash');
                                if (!system) return interaction.reply({ content: 'Slash verification is not available. Check /gateway for your server\'s verification methods.', ephemeral: true });

                                const result = await processVerification({ guild, user: interaction.user, channel: interaction.channel, config: gateway, system, mode: 'slash' });
                                await sendVerificationMessage(interaction.channel, interaction.user, result, gateway, null, system);
                                await interaction.reply({ content: '✅ Verification processed.', ephemeral: true }).catch(() => null);
                            } catch (err) {
                                logger.error(`/verify command error: ${err.message}`);
                                await interaction.reply({ content: 'An error occurred during verification.', ephemeral: true }).catch(() => null);
                            }
                        },

                        // public exports
                        processVerification,
                        sendVerificationMessage,
                        sendWelcomeMessage,
                        assignAutoRoles,
                    };
