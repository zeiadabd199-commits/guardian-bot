import { createEmbed } from '../../utils/embedBuilder.js';
import { getGuildConfig, updateGuildConfig } from '../../core/database.js';
import { logger } from '../../core/logger.js';
import { ensureDefaultConfig } from './config.schema.js';

/**
 * Process user introduction: track user, apply roles, send response
 * @param {Object} params - Parameters
 * @param {Object} params.guild - Discord Guild object
 * @param {Object} params.user - Discord User object
 * @param {Object} params.channel - Discord Channel object
 * @param {Object} params.config - Guild introduce config
 * @returns {Promise<Object>} Result object with status, message, and emoji
 */
export async function processIntroduction(params) {
    const { guild, user, channel, config } = params;

    try {
        // Load fresh config from database
        const guildConfig = await getGuildConfig(guild.id);
        if (!guildConfig) {
            return { status: 'error', message: 'Failed to load configuration', emoji: config?.message?.emoji?.error };
        }

        const introduce = ensureDefaultConfig(guildConfig.modules?.introduce || {});

        // Check if user already introduced
        if (introduce.introducedUsers && introduce.introducedUsers.includes(user.id)) {
            return {
                status: 'already',
                message: `${user.username} has already been introduced to this server!`,
                emoji: introduce.message?.emoji?.already,
            };
        }

        // Apply roles if configured
        if (introduce.roles) {
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (member) {
                if (introduce.roles.addRoleId) {
                    const addRole = await guild.roles.fetch(introduce.roles.addRoleId).catch(() => null);
                    if (addRole) {
                        await member.roles.add(addRole).catch((err) => {
                            logger.error(`Failed to add role: ${err.message}`);
                        });
                    } else {
                        logger.warn(`Add role ${introduce.roles.addRoleId} not found in guild ${guild.id}`);
                    }
                }

                if (introduce.roles.removeRoleId) {
                    const removeRole = await guild.roles.fetch(introduce.roles.removeRoleId).catch(() => null);
                    if (removeRole) {
                        await member.roles.remove(removeRole).catch((err) => {
                            logger.error(`Failed to remove role: ${err.message}`);
                        });
                    } else {
                        logger.warn(`Remove role ${introduce.roles.removeRoleId} not found in guild ${guild.id}`);
                    }
                }
            }
        }

        // Track introduced user
        const updatedIntroducedUsers = introduce.introducedUsers
            ? [...introduce.introducedUsers, user.id]
            : [user.id];

        await updateGuildConfig(guild.id, {
            modules: {
                ...guildConfig.modules,
                introduce: {
                    ...introduce,
                    introducedUsers: updatedIntroducedUsers,
                },
            },
        });

        return {
            status: 'success',
            message: introduce.message?.content || 'Welcome to the server!',
            emoji: introduce.message?.emoji?.success,
        };
    } catch (error) {
        logger.error(`Error processing introduction: ${error.message}`);
        return {
            status: 'error',
            message: 'An error occurred while processing the introduction.',
            emoji: config?.message?.emoji?.error,
        };
    }
}

/**
 * Send introduction message to channel
 * @param {Object} channel - Discord Channel object
 * @param {Object} user - Discord User object
 * @param {Object} result - Result from processIntroduction
 * @param {Object} config - Guild introduce config
 */
export async function sendIntroductionMessage(channel, user, result, config) {
    try {
        let content = '';

        // Add emoji if available
        if (result.emoji) {
            content += `${result.emoji} `;
        }

        // Send based on message type
        if (config.message?.type === 'embed' && config.embed?.enabled) {
            const embedColor = config.embed.color || '#0099FF';
            const hexColor = parseInt(embedColor.replace('#', ''), 16);

            const embed = {
                title: config.embed.title || 'Welcome',
                description: result.message,
                color: hexColor,
                thumbnail: config.embed.thumbnail ? { url: config.embed.thumbnail } : undefined,
                image: config.embed.image ? { url: config.embed.image } : undefined,
                footer: { text: `User: ${user.tag}` },
                timestamp: new Date().toISOString(),
            };

            // Clean up undefined properties
            if (!embed.thumbnail) delete embed.thumbnail;
            if (!embed.image) delete embed.image;

            await channel.send({ embeds: [embed] });
        } else {
            content += result.message;
            await channel.send(content);
        }

        logger.info(`Introduction message sent for ${user.tag} in guild ${channel.guildId}`);
    } catch (error) {
        logger.error(`Error sending introduction message: ${error.message}`);
    }
}

export async function handleEnable(interaction, channelId) {
    try {
        const guildId = interaction.guildId;
        
        const config = await getGuildConfig(guildId);
        if (!config) {
            await interaction.reply({
                embeds: [createEmbed({
                    color: 0xFF0000,
                    title: 'Error',
                    description: 'Failed to load guild configuration',
                })],
                ephemeral: true,
            });
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
                    channelId: channelId || ensuredConfig.channelId,
                },
            },
        });

        await interaction.reply({
            embeds: [createEmbed({
                color: 0x00FF00,
                title: 'Module Enabled',
                description: `Introduce module has been enabled${channelId ? ` for <#${channelId}>` : '.'}`,
            })],
            ephemeral: true,
        });

        logger.info(`Introduce module enabled for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error enabling introduce module: ${error.message}`);
        await interaction.reply({
            embeds: [createEmbed({
                color: 0xFF0000,
                title: 'Error',
                description: 'An error occurred while enabling the module.',
            })],
            ephemeral: true,
        });
    }
}

export async function handleDisable(interaction) {
    try {
        const guildId = interaction.guildId;
        
        const config = await getGuildConfig(guildId);
        if (!config) {
            await interaction.reply({
                embeds: [createEmbed({
                    color: 0xFF0000,
                    title: 'Error',
                    description: 'Failed to load guild configuration',
                })],
                ephemeral: true,
            });
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

        await interaction.reply({
            embeds: [createEmbed({
                color: 0xFF6600,
                title: 'Module Disabled',
                description: 'Introduce module has been disabled.',
            })],
            ephemeral: true,
        });

        logger.info(`Introduce module disabled for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error disabling introduce module: ${error.message}`);
        await interaction.reply({
            embeds: [createEmbed({
                color: 0xFF0000,
                title: 'Error',
                description: 'An error occurred while disabling the module.',
            })],
            ephemeral: true,
        });
    }
}

export async function handleView(interaction) {
    try {
        const guildId = interaction.guildId;
        
        const config = await getGuildConfig(guildId);
        if (!config) {
            await interaction.reply({
                embeds: [createEmbed({
                    color: 0xFF0000,
                    title: 'Error',
                    description: 'Failed to load guild configuration',
                })],
                ephemeral: true,
            });
            return;
        }

        const existingIntroduce = config.modules?.introduce || {};
        const introduce = ensureDefaultConfig(existingIntroduce);

        const statusText = introduce.enabled ? '✅ Enabled' : '❌ Disabled';
        const channelText = introduce.channelId ? `<#${introduce.channelId}>` : 'Not set';
        const messageType = introduce.message?.type || 'text';
        const messageContent = introduce.message?.content || 'No message set';
        const emojiSuccess = introduce.message?.emoji?.success || 'None';
        const emojiAlready = introduce.message?.emoji?.already || 'None';
        const emojiError = introduce.message?.emoji?.error || 'None';
        const embedEnabled = introduce.embed?.enabled ? 'Yes' : 'No';
        const embedTitle = introduce.embed?.title || 'N/A';
        const embedDesc = introduce.embed?.description || 'N/A';
        const addRole = introduce.roles?.addRoleId ? `<@&${introduce.roles.addRoleId}>` : 'None';
        const removeRole = introduce.roles?.removeRoleId ? `<@&${introduce.roles.removeRoleId}>` : 'None';
        const introducedCount = introduce.introducedUsers?.length || 0;

        const description = `**Status:** ${statusText}\n**Channel:** ${channelText}\n\n**Message Configuration:**\n**Type:** ${messageType}\n**Content:** ${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}\n\n**Emojis:**\n**Success:** ${emojiSuccess}\n**Already:** ${emojiAlready}\n**Error:** ${emojiError}\n\n**Embed Configuration:**\n**Enabled:** ${embedEnabled}\n**Title:** ${embedTitle}\n**Description:** ${embedDesc.substring(0, 50)}${embedDesc.length > 50 ? '...' : ''}\n\n**Role Management:**\n**Add Role:** ${addRole}\n**Remove Role:** ${removeRole}\n\n**Statistics:**\n**Introduced Users:** ${introducedCount}`;

        await interaction.reply({
            embeds: [createEmbed({
                color: 0x0099FF,
                title: 'Introduce Module Configuration',
                description,
            })],
            ephemeral: true,
        });
    } catch (error) {
        logger.error(`Error viewing introduce module config: ${error.message}`);
        await interaction.reply({
            embeds: [createEmbed({
                color: 0xFF0000,
                title: 'Error',
                description: 'An error occurred while viewing the configuration.',
            })],
            ephemeral: true,
        });
    }
}
export async function handleMessageSet(interaction, text) {
    try {
        const guildId = interaction.guildId;
        
        const config = await getGuildConfig(guildId);
        if (!config) {
            await interaction.reply({
                embeds: [createEmbed({
                    color: 0xFF0000,
                    title: 'Error',
                    description: 'Failed to load guild configuration',
                })],
                ephemeral: true,
            });
            return;
        }

        const existingIntroduce = config.modules?.introduce || {};
        const ensuredConfig = ensureDefaultConfig(existingIntroduce);

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensuredConfig,
                    message: {
                        ...ensuredConfig.message,
                        content: text,
                    },
                },
            },
        });

        await interaction.reply({
            embeds: [createEmbed({
                color: 0x00FF00,
                title: 'Message Updated',
                description: `Custom message set to:\n\`\`\`${text}\`\`\``,
            })],
            ephemeral: true,
        });

        logger.info(`Introduce module message updated for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error updating introduce message: ${error.message}`);
        await interaction.reply({
            embeds: [createEmbed({
                color: 0xFF0000,
                title: 'Error',
                description: 'An error occurred while updating the message.',
            })],
            ephemeral: true,
        });
    }
}

export async function handleEmojiSet(interaction, emojiString) {
    try {
        const guildId = interaction.guildId;
        
        const config = await getGuildConfig(guildId);
        if (!config) {
            await interaction.reply({
                embeds: [createEmbed({
                    color: 0xFF0000,
                    title: 'Error',
                    description: 'Failed to load guild configuration',
                })],
                ephemeral: true,
            });
            return;
        }

        const existingIntroduce = config.modules?.introduce || {};
        const ensuredConfig = ensureDefaultConfig(existingIntroduce);

        // Parse emoji string format: "success:👋 already:⚠️ error:❌" or single emoji for success
        let emojiConfig = ensuredConfig.message?.emoji || {};

        if (emojiString.includes(':')) {
            // Parse individual emoji assignments
            const pairs = emojiString.split(/\s+/);
            for (const pair of pairs) {
                const [key, emoji] = pair.split(':');
                if (['success', 'already', 'error'].includes(key.toLowerCase())) {
                    emojiConfig[key.toLowerCase()] = emoji;
                }
            }
        } else {
            // Single emoji - set as success
            emojiConfig.success = emojiString;
        }

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensuredConfig,
                    message: {
                        ...ensuredConfig.message,
                        emoji: emojiConfig,
                    },
                },
            },
        });

        const descText = Object.entries(emojiConfig)
            .map(([key, val]) => `**${key}:** ${val}`)
            .join('\n');

        await interaction.reply({
            embeds: [createEmbed({
                color: 0x00FF00,
                title: 'Emojis Updated',
                description: `Emojis set to:\n${descText}`,
            })],
            ephemeral: true,
        });

        logger.info(`Introduce module emojis updated for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error updating introduce emojis: ${error.message}`);
        await interaction.reply({
            embeds: [createEmbed({
                color: 0xFF0000,
                title: 'Error',
                description: 'An error occurred while updating the emojis.',
            })],
            ephemeral: true,
        });
    }
}

export async function handleEmbedToggle(interaction, enabled) {
    try {
        const guildId = interaction.guildId;
        
        const config = await getGuildConfig(guildId);
        if (!config) {
            await interaction.reply({
                embeds: [createEmbed({
                    color: 0xFF0000,
                    title: 'Error',
                    description: 'Failed to load guild configuration',
                })],
                ephemeral: true,
            });
            return;
        }

        const existingIntroduce = config.modules?.introduce || {};
        const ensuredConfig = ensureDefaultConfig(existingIntroduce);

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...ensuredConfig,
                    embed: {
                        ...ensuredConfig.embed,
                        enabled: enabled,
                    },
                },
            },
        });

        const statusText = enabled ? '✅ Enabled' : '❌ Disabled';
        await interaction.reply({
            embeds: [createEmbed({
                color: 0x00FF00,
                title: 'Embed Status Updated',
                description: `Embed display is now ${statusText}`,
            })],
            ephemeral: true,
        });

        logger.info(`Introduce module embed status updated for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error updating introduce embed status: ${error.message}`);
        await interaction.reply({
            embeds: [createEmbed({
                color: 0xFF0000,
                title: 'Error',
                description: 'An error occurred while updating the embed status.',
            })],
            ephemeral: true,
        });
    }
}