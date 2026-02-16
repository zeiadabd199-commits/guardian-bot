import { createEmbed } from '../../utils/embedBuilder.js';
import { getGuildConfig, updateGuildConfig } from '../../core/database.js';
import { logger } from '../../core/logger.js';
import { ensureDefaultConfig } from './config.schema.js';

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
        const emoji = introduce.message?.emoji || 'None';
        const embedEnabled = introduce.embed?.enabled ? 'Yes' : 'No';
        const embedTitle = introduce.embed?.title || 'N/A';
        const embedDesc = introduce.embed?.description || 'N/A';

        const description = `**Status:** ${statusText}\n**Channel:** ${channelText}\n\n**Message Configuration:**\n**Type:** ${messageType}\n**Content:** ${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}\n**Emoji:** ${emoji}\n\n**Embed Configuration:**\n**Enabled:** ${embedEnabled}\n**Title:** ${embedTitle}\n**Description:** ${embedDesc.substring(0, 50)}${embedDesc.length > 50 ? '...' : ''}`;

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

export async function handleEmojiSet(interaction, emoji) {
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
                        emoji: emoji,
                    },
                },
            },
        });

        await interaction.reply({
            embeds: [createEmbed({
                color: 0x00FF00,
                title: 'Emoji Updated',
                description: `Emoji set to: ${emoji}`,
            })],
            ephemeral: true,
        });

        logger.info(`Introduce module emoji updated for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error updating introduce emoji: ${error.message}`);
        await interaction.reply({
            embeds: [createEmbed({
                color: 0xFF0000,
                title: 'Error',
                description: 'An error occurred while updating the emoji.',
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