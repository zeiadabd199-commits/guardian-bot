++ 
import { createEmbed } from '../../utils/embedBuilder.js';
import { getGuildConfig, updateGuildConfig } from '../../core/database.js';
import { logger } from '../../core/logger.js';
import { ensureDefaultConfig } from './config.schema.js';

/**
 * Role-based verification processing.
 * - Uses roles to determine verification state (no introducedUsers array)
 * - Validates triggerWord (case-insensitive exact match)
 */
export async function processIntroduction(params) {
    const { guild, user, channel, config } = params;
    const messageObject = params.messageObject || null;

    try {
        const guildConfig = await getGuildConfig(guild.id);
        if (!guildConfig) {
            return { status: 'error', message: 'Failed to load configuration', reaction: config?.message?.reactions?.error };
        }

        const introduce = ensureDefaultConfig(guildConfig.modules?.introduce || {});

        // Fetch member
        const member = await guild.members.fetch(user.id).catch(() => null);

        // If verify role is configured and member already has it
        if (introduce.roles?.verifyRoleId && member && member.roles.cache.has(introduce.roles.verifyRoleId)) {
            return {
                status: 'already',
                message: introduce.message.already,
                reaction: introduce.message.reactions.already,
            };
        }

        // Ensure triggerWord is set and matches (case-insensitive exact)
        if (introduce.triggerWord) {
            const incoming = String(params.inputContent ?? (messageObject ? messageObject.content : '')).trim().toLowerCase();
            const trigger = String(introduce.triggerWord).trim().toLowerCase();
            if (incoming !== trigger) {
                return {
                    status: 'error',
                    message: introduce.message.error,
                    reaction: introduce.message.reactions.error,
                };
            }
        }

        // At this point, verification should proceed: add verifyRole, remove pending/removeRole
        if (member) {
            const botMember = guild.members.me;
            const canManageRoles = botMember && botMember.permissions.has?.('ManageRoles');

            if (!canManageRoles) {
                logger.warn(`Bot lacks ManageRoles in guild ${guild.id}; role changes skipped`);
            } else {
                // Remove pending role if present
                if (introduce.roles?.pendingRoleId) {
                    const pending = await guild.roles.fetch(introduce.roles.pendingRoleId).catch(() => null);
                    if (pending && member.roles.cache.has(pending.id)) {
                        await member.roles.remove(pending).catch(err => logger.error(`Failed removing pending role: ${err.message}`));
                    }
                }

                // Remove optional removeRoleId
                if (introduce.roles?.removeRoleId) {
                    const rem = await guild.roles.fetch(introduce.roles.removeRoleId).catch(() => null);
                    if (rem && member.roles.cache.has(rem.id)) {
                        await member.roles.remove(rem).catch(err => logger.error(`Failed removing removeRoleId: ${err.message}`));
                    }
                }

                // Add verify role
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
            message: introduce.message.success,
            reaction: introduce.message.reactions.success,
        };
    } catch (err) {
        logger.error(`Error processing verification: ${err.message}`);
        return {
            status: 'error',
            message: config?.message?.error ?? 'An error occurred during verification.',
            reaction: config?.message?.reactions?.error,
        };
    }
}

/**
 * Send verification/response message according to config
 */
export async function sendIntroductionMessage(channel, user, result, config, originalMessage = null) {
    try {
        const introduce = ensureDefaultConfig(config || {});
        const safeResult = result || { status: 'error', message: 'No result', reaction: introduce.message.reactions.error };

        const reactionEmoji = safeResult.reaction || null;
        const content = safeResult.message || '';

        const deliveryTarget = introduce.message.delivery === 'dm' ? 'dm' : 'channel';

        if (deliveryTarget === 'dm') {
            await user.send(content).catch((err) => {
                logger.warn(`Failed to DM user ${user.id}: ${err.message}`);
                if (channel) channel.send(content).catch(e => logger.warn(`Failed fallback channel send: ${e.message}`));
            });
        } else {
            if (channel) await channel.send(content).catch(err => logger.warn(`Failed sending channel message: ${err.message}`));
        }

        if (introduce.message.emojiMode === true && reactionEmoji && originalMessage) {
            try {
                await originalMessage.react(reactionEmoji);
            } catch (err) {
                logger.warn(`Failed to react with emoji ${reactionEmoji}: ${err.message}`);
            }
        }

        logger.info(`Verification message sent for ${user.tag} in guild ${channel?.guildId}`);
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

        const newMessage = { ...ensured.message };
        if (['success', 'already', 'error', 'dm'].includes(key)) {
            newMessage[key] = text;
        }

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensured,
                    message: newMessage,
                },
            },
        });

        await interaction.reply({ content: `Message '${key}' updated.`, ephemeral: true });
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
        const messageSuccess = introduce.message?.success || 'No success message set';
        const messageAlready = introduce.message?.already || 'No already message set';
        const messageError = introduce.message?.error || 'No error message set';
        const dmMessage = introduce.message?.dm || 'No DM message set';
        const emojiMode = introduce.message?.emojiMode ? 'Yes' : 'No';
        const reactionSuccess = introduce.message?.reactions?.success || 'None';
        const reactionAlready = introduce.message?.reactions?.already || 'None';
        const reactionError = introduce.message?.reactions?.error || 'None';
        const embedEnabled = introduce.embed?.enabled ? 'Yes' : 'No';
        const embedTitle = introduce.embed?.title || 'N/A';
        const embedDesc = introduce.embed?.description || 'N/A';
        const verifyRole = introduce.roles?.verifyRoleId ? `<@&${introduce.roles.verifyRoleId}>` : 'None';
        const pendingRole = introduce.roles?.pendingRoleId ? `<@&${introduce.roles.pendingRoleId}>` : 'None';
        const removeRole = introduce.roles?.removeRoleId ? `<@&${introduce.roles.removeRoleId}>` : 'None';

        const description = `**Status:** ${statusText}\n**Verify Channel:** ${channelText}\n\n**Messages:**\n**Success:** ${messageSuccess}\n**Already:** ${messageAlready}\n**Error:** ${messageError}\n**DM:** ${dmMessage}\n\n**Reactions / Emoji Mode:**\n**Emoji Mode Enabled:** ${emojiMode}\n**Success:** ${reactionSuccess}\n**Already:** ${reactionAlready}\n**Error:** ${reactionError}\n\n**Embed Configuration:**\n**Enabled:** ${embedEnabled}\n**Title:** ${embedTitle}\n**Description:** ${embedDesc.substring(0, 50)}${embedDesc.length > 50 ? '...' : ''}\n\n**Role Management:**\n**Verify Role:** ${verifyRole}\n**Pending Role:** ${pendingRole}\n**Remove Role:** ${removeRole}`;

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

        await updateGuildConfig(guildId, { modules: { ...config.modules, introduce: { ...ensuredConfig, message: { ...ensuredConfig.message, content: text } } } });

        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Message Updated', description: `Custom message set to:\n\\`\\`\\`${text}\\`\\`\\`` })], ephemeral: true });

        logger.info(`Introduce module message updated for guild ${guildId}`);
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

        let reactions = ensuredConfig.message?.reactions || {};
        if (emojiString.includes(':')) {
            const pairs = emojiString.split(/\s+/);
            for (const pair of pairs) {
                const [key, emoji] = pair.split(':');
                if (['success', 'already', 'error'].includes(key.toLowerCase())) {
                    reactions[key.toLowerCase()] = emoji;
                }
            }
        } else {
            reactions.success = emojiString;
        }

        await updateGuildConfig(guildId, { modules: { ...config.modules, introduce: { ...ensuredConfig, message: { ...ensuredConfig.message, reactions } } } });

        const descText = Object.entries(reactions).map(([k, v]) => `**${k}:** ${v}`).join('\n');
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

        await updateGuildConfig(guildId, { modules: { ...config.modules, introduce: { ...ensuredConfig, embed: { ...ensuredConfig.embed, enabled } } } });

        const statusText = enabled ? '✅ Enabled' : '❌ Disabled';
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Embed Status Updated', description: `Embed display is now ${statusText}` })], ephemeral: true });
        logger.info(`Introduce module embed status updated for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error updating introduce embed status: ${error.message}`);
        await interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'An error occurred while updating the embed status.' })], ephemeral: true });
    }
}
