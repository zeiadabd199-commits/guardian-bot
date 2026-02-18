import { Events } from 'discord.js';
import { getGuildConfig, updateGuildConfig } from '../core/database.js';
import { logger } from '../core/logger.js';
import trustService from '../core/trustService.js';
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

            // --- Mention abuse protection ---
            try {
                const sev = gateway.security || {};
                const mentionThreshold = (sev.mentionThreshold && Number.isInteger(sev.mentionThreshold)) ? sev.mentionThreshold : 6;

                // @everyone spam
                if (message.mentions.everyone) {
                    await message.delete().catch(() => null);
                    logger.security(`@everyone abuse by ${message.author.id} in ${message.guildId}`);
                    try { await trustService.incrementSuspicion(message.guildId, message.author.id, 'everyone_mention'); } catch (e) { logger.warn(`trust increment failed: ${e.message}`); }
                    return;
                }

                // Mass mentions
                const totalMentions = (message.mentions.users?.size || 0) + (message.mentions.roles?.size || 0);
                if (totalMentions >= mentionThreshold) {
                    await message.delete().catch(() => null);
                    logger.security(`Mass mention abuse (${totalMentions}) by ${message.author.id} in ${message.guildId}`);
                    try { await trustService.incrementSuspicion(message.guildId, message.author.id, 'mention_spam'); } catch (e) { logger.warn(`trust increment failed: ${e.message}`); }
                    return;
                }
            } catch (err) {
                logger.warn(`Mention protection failed: ${err.message}`);
            }

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