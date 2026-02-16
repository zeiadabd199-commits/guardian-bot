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

            // Enforce verify channel (if set)
            if (introduce.verifyChannelId && introduce.verifyChannelId !== message.channelId) return;

            // IMPORTANT:
            // Do NOT block execution if trigger word is wrong.
            // processIntroduction will determine success/error and return proper result.

            const result = await introduceModule.processIntroduction({
                guild: message.guild,
                user: message.author,
                channel: message.channel,
                messageObject: message,
                inputContent: message.content,
                config: introduce,
            });

            // Send verification response (DM or channel + reactions)
            await introduceModule.sendIntroductionMessage(
                message.channel,
                message.author,
                result,
                introduce,
                message
            );

        } catch (error) {
            logger.error(`Error in messageCreate event: ${error.message}`);
        }
    },
};