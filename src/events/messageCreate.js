import { Events } from 'discord.js';
import { getGuildConfig } from '../core/database.js';
import { logger } from '../core/logger.js';
import introduceModule from '../modules/introduce/index.js';

export default {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore bot messages
        if (message.author.bot) return;

        // Ignore DMs
        if (!message.guild) return;

        try {
            // Load guild configuration
            const guildConfig = await getGuildConfig(message.guildId);
            if (!guildConfig) return;

            // Check if introduce module is enabled
            const introduce = guildConfig.modules?.introduce;
            if (!introduce || !introduce.enabled) return;

            // Check if message is in the configured channel
            if (introduce.channelId !== message.channelId) return;

            // Process introduction
            const result = await introduceModule.processIntroduction({
                guild: message.guild,
                user: message.author,
                channel: message.channel,
                config: introduce,
            });

            // Send introduction message
            await introduceModule.sendIntroductionMessage(message.channel, message.author, result, introduce);
        } catch (error) {
            logger.error(`Error in messageCreate event: ${error.message}`);
        }
    },
};
