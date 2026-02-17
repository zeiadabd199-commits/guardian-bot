import { createEmbed } from '../../utils/embedBuilder.js';
import { getGuildConfig, updateGuildConfig } from '../../core/database.js';
import { logger } from '../../core/logger.js';
import { ensureDefaultConfig } from './config.schema.js';

/**
 * Role-based verification processing.
 * - Uses roles to determine verification state (no introducedUsers array)
 * - Validates triggerWord (case-insensitive exact match)
 * - Returns state message config for delivery
 */
export async function processIntroduction(params) {
    const { guild, user, channel, config } = params;
    const messageObject = params.messageObject || null;

    try {
        const guildConfig = await getGuildConfig(guild.id);
        if (!guildConfig) {
            return {
                status: 'error',
                stateKey: 'error',
                message: config?.messages?.error?.text ?? 'Failed to load configuration',
                messageConfig: config?.messages?.error,
            };
        }

        const introduce = ensureDefaultConfig(guildConfig.modules?.introduce || {});

        const member = await guild.members.fetch(user.id).catch(() => null);

        if (introduce.roles?.verifyRoleId && member && member.roles.cache.has(introduce.roles.verifyRoleId)) {
            return {
                status: 'already',
                stateKey: 'already',
                message: introduce.messages.already.text,
                messageConfig: introduce.messages.already,
            };
        }

        if (introduce.triggerWord) {
            const incoming = String(params.inputContent ?? (messageObject ? messageObject.content : '')).trim().toLowerCase();
            const trigger = String(introduce.triggerWord).trim().toLowerCase();
            if (incoming !== trigger) {
                return {
                    status: 'error',
                    stateKey: 'error',
                    message: introduce.messages.error.text,
                    messageConfig: introduce.messages.error,
                };
            }
        }

        if (member) {
            const botMember = guild.members.me;
            const canManageRoles = botMember && botMember.permissions.has?.('ManageRoles');

            if (!canManageRoles) {
                logger.warn(`Bot lacks ManageRoles in guild ${guild.id}; role changes skipped`);
            } else {
                if (introduce.roles?.pendingRoleId) {
                    const pending = await guild.roles.fetch(introduce.roles.pendingRoleId).catch(() => null);
                    if (pending && member.roles.cache.has(pending.id)) {
                        await member.roles.remove(pending).catch(err => logger.error(`Failed removing pending role: ${err.message}`));
                    }
                }

                if (introduce.roles?.removeRoleId) {
                    const rem = await guild.roles.fetch(introduce.roles.removeRoleId).catch(() => null);
                    if (rem && member.roles.cache.has(rem.id)) {
                        await member.roles.remove(rem).catch(err => logger.error(`Failed removing removeRoleId: ${err.message}`));
                    }
                }

                if (introduce.roles?.verifyRoleId) {
                    const verifyRole = await guild.roles.fetch(introduce.roles.verifyRoleId).catch(() => null);
                    if (verifyRole && !member.roles.cache.has(verifyRole.id)) {
                        await member.roles.add(verifyRole).catch(err => logger.error(`Failed adding verify role: ${err.message}`));
                    }
                }
            }
        }

        return {
            status: 'success',
            stateKey: 'success',
            message: introduce.messages.success.text,
            messageConfig: introduce.messages.success,
        };
    } catch (err) {
        logger.error(`Error processing verification: ${err.message}`);
        return {
            status: 'error',
            stateKey: 'error',
            message: config?.messages?.error?.text ?? 'An error occurred during verification.',
            messageConfig: config?.messages?.error,
        };
    }
}

/**
 * Send verification response message according to state config
 * Handles delivery modes: 'channel', 'dm', 'both'
 * Includes embed rendering with per-state customization
 */
export async function sendIntroductionMessage(channel, user, result, config, originalMessage = null) {
    try {
        const introduce = ensureDefaultConfig(config || {});
        const messageConfig = result?.messageConfig || introduce.messages.error;
        const stateKey = result?.stateKey || 'error';

        if (!messageConfig) {
            logger.warn(`No message config for state: ${stateKey}`);
            return;
        }

        const textContent = messageConfig.text || '';
        const deliveryMode = messageConfig.delivery || 'channel';
        const reactionEmoji = messageConfig.reaction || null;
        const embedConfig = messageConfig.embed || {};

        const buildMessage = () => {
            if (embedConfig.enabled) {
                const embedColor = embedConfig.color || '#0099FF';
                const hexColor = parseInt(embedColor.replace('#', ''), 16);

                return {
                    content: '',
                    embeds: [
                        {
                            title: embedConfig.title || 'Verification',
                            description: textContent,
                            color: hexColor,
                            thumbnail: embedConfig.thumbnail ? { url: embedConfig.thumbnail } : undefined,
                            image: embedConfig.image ? { url: embedConfig.image } : undefined,
                            footer: { text: `User: ${user.tag}` },
                            timestamp: new Date().toISOString(),
                        },
                    ]
                };
            } else {
                return { content: textContent };
            }
        };

        const messagePayload = buildMessage();

        if (deliveryMode === 'dm' || deliveryMode === 'both') {
            await user.send(messagePayload).catch((err) => {
                logger.warn(`Failed to DM user ${user.id}: ${err.message}`);
                if (deliveryMode === 'both' && channel) {
                    channel.send(messagePayload).catch(e => logger.warn(`Fallback channel send failed: ${e.message}`));
                }
            });
        }

        if (deliveryMode === 'channel' || deliveryMode === 'both') {
            if (channel) {
                await channel.send(messagePayload).catch(err => logger.warn(`Failed sending channel message: ${err.message}`));
            }
        }

        if (reactionEmoji && originalMessage && stateKey !== 'dm_prompt') {
            try {
                await originalMessage.react(reactionEmoji);
            } catch (err) {
                logger.warn(`Failed to react with emoji ${reactionEmoji}: ${err.message}`);
            }
        }

        logger.info(`Verification message sent for ${user.tag} in guild ${channel?.guildId} (${stateKey})`);
    } catch (error) {
        logger.error(`Error sending verification message: ${error.message}`);
    }
}

// ------------------ Slash command handlers for new settings ------------------
export async function handleTriggerSet(interaction, word) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });

        const existing = config.modules?.introduce || {};
        const ensured = ensureDefaultConfig(existing);

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensured,
                    triggerWord: word ? String(word).trim() : null,
                },
            },
        });

        await interaction.reply({ content: `Trigger word set to: ${word ?? 'none'}`, ephemeral: true });
    } catch (err) {
        logger.error(`Error setting trigger word: ${err.message}`);
        await interaction.reply({ content: 'Error setting trigger word', ephemeral: true });
    }
}

export async function handleRoleSet(interaction, type, role) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });

        const existing = config.modules?.introduce || {};
        const ensured = ensureDefaultConfig(existing);

        const newRoles = { ...ensured.roles };
        if (type === 'verify') newRoles.verifyRoleId = role?.id ?? null;
        if (type === 'pending') newRoles.pendingRoleId = role?.id ?? null;
        if (type === 'remove') newRoles.removeRoleId = role?.id ?? null;

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensured,
                    roles: newRoles,
                },
            },
        });

        await interaction.reply({ content: `Role ${type} set to ${role ? `<@&${role.id}>` : 'none'}`, ephemeral: true });
    } catch (err) {
        logger.error(`Error setting role ${type}: ${err.message}`);
        await interaction.reply({ content: `Error setting role ${type}`, ephemeral: true });
    }
}

export async function handleChannelSet(interaction, channel) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });

        const existing = config.modules?.introduce || {};
        const ensured = ensureDefaultConfig(existing);

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensured,
                    verifyChannelId: channel?.id ?? null,
                },
            },
        });

        await interaction.reply({ content: `Verify channel set to ${channel ? `<#${channel.id}>` : 'none'}`, ephemeral: true });
    } catch (err) {
        logger.error(`Error setting verify channel: ${err.message}`);
        await interaction.reply({ content: 'Error setting verify channel', ephemeral: true });
    }
}

export async function handleMessageKeySet(interaction, key, text) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });

        const existing = config.modules?.introduce || {};
        const ensured = ensureDefaultConfig(existing);

        const newMessages = { ...ensured.messages };
        if (['success', 'already', 'error', 'dm_prompt'].includes(key)) {
            if (!newMessages[key]) {
                newMessages[key] = {
                    text: '',
                    embed: { enabled: false, title: 'Verification', description: '', color: '#0099FF', image: null, thumbnail: null },
                    delivery: 'channel',
                    reaction: null,
                };
            }
            newMessages[key].text = text;
        }

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensured,
                    messages: newMessages,
                },
            },
        });

        await interaction.reply({ content: `Message '${key}' text updated.`, ephemeral: true });
    } catch (err) {
        logger.error(`Error updating message ${key}: ${err.message}`);
        await interaction.reply({ content: `Error updating message ${key}`, ephemeral: true });
    }
}

export async function handleEnable(interaction, channelId) {
    try {
        const guildId = interaction.guildId;

        const config = await getGuildConfig(guildId);
        if (!config) {
            await interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'Failed to load guild configuration' })], ephemeral: true });
            return;
        }

        const existingIntroduce = config.modules?.introduce || {};
        const ensuredConfig = ensureDefaultConfig(existingIntroduce);

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensuredConfig,
                    enabled: true,
                    verifyChannelId: channelId || ensuredConfig.verifyChannelId,
                },
            },
        });

        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Module Enabled', description: `Introduce module has been enabled${channelId ? ` for <#${channelId}>` : '.'}` })], ephemeral: true });

        logger.info(`Introduce module enabled for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error enabling introduce module: ${error.message}`);
        await interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'An error occurred while enabling the module.' })], ephemeral: true });
    }
}

export async function handleDisable(interaction) {
    try {
        const guildId = interaction.guildId;

        const config = await getGuildConfig(guildId);
        if (!config) {
            await interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'Failed to load guild configuration' })], ephemeral: true });
            return;
        }

        const existingIntroduce = config.modules?.introduce || {};
        const ensuredConfig = ensureDefaultConfig(existingIntroduce);

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensuredConfig,
                    enabled: false,
                },
            },
        });

        await interaction.reply({ embeds: [createEmbed({ color: 0xFF6600, title: 'Module Disabled', description: 'Introduce module has been disabled.' })], ephemeral: true });

        logger.info(`Introduce module disabled for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error disabling introduce module: ${error.message}`);
        await interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'An error occurred while disabling the module.' })], ephemeral: true });
    }
}

export async function handleView(interaction) {
    try {
        const guildId = interaction.guildId;

        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'Failed to load guild configuration' })], ephemeral: true });

        const existingIntroduce = config.modules?.introduce || {};
        const introduce = ensureDefaultConfig(existingIntroduce);

        const statusText = introduce.enabled ? '✅ Enabled' : '❌ Disabled';
        const channelText = introduce.verifyChannelId ? `<#${introduce.verifyChannelId}>` : 'Not set';
        const triggerWord = introduce.triggerWord || 'Not set';

        const successText = introduce.messages?.success?.text || 'No text set';
        const successDelivery = introduce.messages?.success?.delivery || 'channel';
        const successEmoji = introduce.messages?.success?.reaction || 'None';
        const successEmbedEnabled = introduce.messages?.success?.embed?.enabled ? 'Yes' : 'No';

        const alreadyText = introduce.messages?.already?.text || 'No text set';
        const alreadyDelivery = introduce.messages?.already?.delivery || 'channel';
        const alreadyEmoji = introduce.messages?.already?.reaction || 'None';

        const errorText = introduce.messages?.error?.text || 'No text set';
        const errorDelivery = introduce.messages?.error?.delivery || 'channel';
        const errorEmoji = introduce.messages?.error?.reaction || 'None';

        const dmText = introduce.messages?.dm_prompt?.text || 'No text set';
        const dmDelivery = introduce.messages?.dm_prompt?.delivery || 'dm';

        const verifyRole = introduce.roles?.verifyRoleId ? `<@&${introduce.roles.verifyRoleId}>` : 'None';
        const pendingRole = introduce.roles?.pendingRoleId ? `<@&${introduce.roles.pendingRoleId}>` : 'None';
        const removeRole = introduce.roles?.removeRoleId ? `<@&${introduce.roles.removeRoleId}>` : 'None';

        const description = `**Status:** ${statusText}\n**Verify Channel:** ${channelText}\n**Trigger Word:** ${triggerWord}\n\n**Success Message:**\n**Text:** ${successText.substring(0, 80)}${successText.length > 80 ? '...' : ''}\n**Delivery:** ${successDelivery}\n**Reaction:** ${successEmoji}\n**Embed:** ${successEmbedEnabled}\n\n**Already Verified:**\n**Text:** ${alreadyText.substring(0, 80)}${alreadyText.length > 80 ? '...' : ''}\n**Delivery:** ${alreadyDelivery}\n**Reaction:** ${alreadyEmoji}\n\n**Error Message:**\n**Text:** ${errorText.substring(0, 80)}${errorText.length > 80 ? '...' : ''}\n**Delivery:** ${errorDelivery}\n**Reaction:** ${errorEmoji}\n\n**DM Prompt:**\n**Text:** ${dmText.substring(0, 80)}${dmText.length > 80 ? '...' : ''}\n**Delivery:** ${dmDelivery}\n\n**Role Management:**\n**Verify Role:** ${verifyRole}\n**Pending Role:** ${pendingRole}\n**Remove Role:** ${removeRole}`;

        await interaction.reply({ embeds: [createEmbed({ color: 0x0099FF, title: 'Introduce Module Configuration', description })], ephemeral: true });
    } catch (error) {
        logger.error(`Error viewing introduce module config: ${error.message}`);
        await interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'An error occurred while viewing the configuration.' })], ephemeral: true });
    }
}

export async function handleMessageSet(interaction, text) {
    try {
        const guildId = interaction.guildId;

        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'Failed to load guild configuration' })], ephemeral: true });

        const existingIntroduce = config.modules?.introduce || {};
        const ensuredConfig = ensureDefaultConfig(existingIntroduce);

        const newMessages = { ...ensuredConfig.messages };
        if (newMessages.success) {
            newMessages.success.text = text;
        }

        await updateGuildConfig(guildId, { modules: { ...config.modules, introduce: { ...ensuredConfig, messages: newMessages } } });

        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Success Message Updated', description: `Text updated to:\n\`\`\`${text}\`\`\`` })], ephemeral: true });

        logger.info(`Introduce module success message updated for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error updating introduce message: ${error.message}`);
        await interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'An error occurred while updating the message.' })], ephemeral: true });
    }
}

export async function handleEmojiSet(interaction, emojiString) {
    try {
        const guildId = interaction.guildId;

        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'Failed to load guild configuration' })], ephemeral: true });

        const existingIntroduce = config.modules?.introduce || {};
        const ensuredConfig = ensureDefaultConfig(existingIntroduce);

        const newMessages = { ...ensuredConfig.messages };

        if (emojiString.includes(':')) {
            const pairs = emojiString.split(/\s+/);
            for (const pair of pairs) {
                const [key, emoji] = pair.split(':');
                if (['success', 'already', 'error'].includes(key.toLowerCase())) {
                    if (newMessages[key.toLowerCase()]) {
                        newMessages[key.toLowerCase()].reaction = emoji;
                    }
                }
            }
        } else {
            if (newMessages.success) {
                newMessages.success.reaction = emojiString;
            }
        }

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensuredConfig,
                    messages: newMessages,
                },
            },
        });

        const descText = `**success:** ${newMessages.success?.reaction || 'None'}\n**already:** ${newMessages.already?.reaction || 'None'}\n**error:** ${newMessages.error?.reaction || 'None'}`;
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Reactions Updated', description: `Reactions set to:\n${descText}` })], ephemeral: true });
        logger.info(`Introduce module reactions updated for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error updating reactions: ${error.message}`);
        await interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'An error occurred while updating reactions.' })], ephemeral: true });
    }
}

export async function handleEmbedToggle(interaction, enabled) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'Failed to load guild configuration' })], ephemeral: true });

        const existingIntroduce = config.modules?.introduce || {};
        const ensuredConfig = ensureDefaultConfig(existingIntroduce);

        const newMessages = { ...ensuredConfig.messages };
        if (newMessages.success && newMessages.success.embed) {
            newMessages.success.embed.enabled = enabled;
        }

        await updateGuildConfig(guildId, { modules: { ...config.modules, introduce: { ...ensuredConfig, messages: newMessages } } });

        const statusText = enabled ? '✅ Enabled' : '❌ Disabled';
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Success Message Embed Updated', description: `Embed display is now ${statusText}` })], ephemeral: true });
        logger.info(`Introduce module embed status updated for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error updating introduce embed status: ${error.message}`);
        await interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'An error occurred while updating the embed status.' })], ephemeral: true });
    }
}

/**
 * Set delivery mode for a specific message state
 * @param {Interaction} interaction - Discord interaction
 * @param {string} state - Message state: 'success', 'already', 'error', or 'dm_prompt'
 * @param {string} delivery - Delivery mode: 'channel', 'dm', or 'both'
 */
export async function handleDeliverySet(interaction, state, delivery) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });

        const existing = config.modules?.introduce || {};
        const ensured = ensureDefaultConfig(existing);

        if (!['success', 'already', 'error', 'dm_prompt'].includes(state)) {
            return interaction.reply({ content: 'Invalid state. Use: success, already, error, dm_prompt', ephemeral: true });
        }

        if (!['channel', 'dm', 'both'].includes(delivery)) {
            return interaction.reply({ content: 'Invalid delivery mode. Use: channel, dm, both', ephemeral: true });
        }

        const newMessages = { ...ensured.messages };
        if (newMessages[state]) {
            newMessages[state].delivery = delivery;
        }

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensured,
                    messages: newMessages,
                },
            },
        });

        await interaction.reply({ content: `Delivery mode for '${state}' set to: ${delivery}`, ephemeral: true });
    } catch (err) {
        logger.error(`Error setting delivery mode: ${err.message}`);
        await interaction.reply({ content: 'Error setting delivery mode', ephemeral: true });
    }
}

/**
 * Configure embed settings for a specific message state
 * @param {Interaction} interaction - Discord interaction
 * @param {string} state - Message state
 * @param {string} setting - Embed setting: 'enable', 'disable', 'title', 'description', 'color', 'image', 'thumbnail'
 * @param {string} value - New value for the setting
 */
export async function handleStateEmbedSet(interaction, state, setting, value) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });

        const existing = config.modules?.introduce || {};
        const ensured = ensureDefaultConfig(existing);

        if (!['success', 'already', 'error', 'dm_prompt'].includes(state)) {
            return interaction.reply({ content: 'Invalid state', ephemeral: true });
        }

        const newMessages = { ...ensured.messages };
        if (!newMessages[state]) {
            return interaction.reply({ content: `No config found for state: ${state}`, ephemeral: true });
        }

        const embedConfig = newMessages[state].embed;

        if (setting === 'enable') {
            embedConfig.enabled = true;
        } else if (setting === 'disable') {
            embedConfig.enabled = false;
        } else if (setting === 'title') {
            embedConfig.title = value || 'Verification';
        } else if (setting === 'description') {
            embedConfig.description = value || '';
        } else if (setting === 'color') {
            embedConfig.color = value || '#0099FF';
        } else if (setting === 'image') {
            embedConfig.image = value || null;
        } else if (setting === 'thumbnail') {
            embedConfig.thumbnail = value || null;
        } else {
            return interaction.reply({ content: 'Invalid embed setting', ephemeral: true });
        }

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensured,
                    messages: newMessages,
                },
            },
        });

        await interaction.reply({ content: `Embed setting '${setting}' for state '${state}' updated.`, ephemeral: true });
    } catch (err) {
        logger.error(`Error setting embed config: ${err.message}`);
        await interaction.reply({ content: 'Error setting embed config', ephemeral: true });
    }
}