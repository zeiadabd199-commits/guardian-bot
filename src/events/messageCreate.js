import { Events } from 'discord.js';
import { getGuildConfig } from '../core/database.js';
import { logger } from '../core/logger.js';
import introduceModule from '../modules/introduce/index.js';
import { ensureDefaultConfig } from '../modules/introduce/config.schema.js';

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

            // Ensure full default config
            const introduce = ensureDefaultConfig(guildConfig.modules?.introduce || {});
            if (!introduce || !introduce.enabled) return;

            // If channel is configured, enforce channel lock
            if (introduce.channelId && introduce.channelId !== message.channelId) return;

            // If a trigger word is set, only proceed when it matches the message content
            const trigger = introduce.triggerWord ? String(introduce.triggerWord).trim().toLowerCase() : null;
            if (trigger && message.content?.trim().toLowerCase() !== trigger) return;

            // Process introduction (pass the original message so reactions/DMs can be applied)
            const result = await introduceModule.processIntroduction({
                guild: message.guild,
                user: message.author,
                channel: message.channel,
                messageObject: message,
                config: introduce,
            });

            // Send introduction message
            await introduceModule.sendIntroductionMessage(message.channel, message.author, result, introduce, message);
        } catch (error) {
            logger.error(`Error in messageCreate event: ${error.message}`);
        }
    },
};
