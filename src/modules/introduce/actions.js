import { createEmbed } from '../../utils/embedBuilder.js';
import { getGuildConfig, updateGuildConfig } from '../../core/database.js';
import { logger } from '../../core/logger.js';

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

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...config.modules.introduce,
                    enabled: true,
                    channelId: channelId || config.modules.introduce?.channelId,
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

        await updateGuildConfig(guildId, {
            modules: {
                ...config.modules,
                introduce: {
                    ...config.modules.introduce,
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

        const introduce = config.modules?.introduce || {};
        const statusText = introduce.enabled ? '✅ Enabled' : '❌ Disabled';
        const channelText = introduce.channelId ? `<#${introduce.channelId}>` : 'Not set';
        const messageText = introduce.message || 'No custom message configured';
        const embedText = introduce.embedEnabled ? 'Yes' : 'No';

        const description = `**Status:** ${statusText}\n**Channel:** ${channelText}\n**Embed Enabled:** ${embedText}\n**Custom Message:** ${messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText}`;

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
