import { Events } from 'discord.js';
import { getGuildConfig } from '../core/database.js';
import { logger } from '../core/logger.js';
import gatewayModule from '../modules/gateway/index.js';
import { ensureDefaultConfig } from '../modules/gateway/config.schema.js';

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
            const gateway = ensureDefaultConfig(guildConfig.modules?.gateway || {});
            if (!gateway || !gateway.enabled) return;

            // Enforce verify channel (if set)
            if (gateway.verifyChannelId && gateway.verifyChannelId !== message.channelId) return;

            // Process verification / gateway introduction
            const result = await gatewayModule.processIntroduction({
                guild: message.guild,
                user: message.author,
                channel: message.channel,
                messageObject: message,
                inputContent: message.content,
                config: gateway,
            });

            // Send response
            await gatewayModule.sendIntroductionMessage(
                message.channel,
                message.author,
                result,
                gateway,
                message
            );

        } catch (error) {
            logger.error(`Error in messageCreate event: ${error.message}`);
        }
    },
};