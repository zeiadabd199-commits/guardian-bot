import { Events } from 'discord.js';
import { performVerify } from '../core/gatewayLogic.js';
import { getGuildConfig } from '../core/database.js';
export default {
        name: Events.MessageReactionAdd,
            async execute(reaction, user, client) {
                        if (user.bot || !reaction.message.guild) return;
                                if (reaction.partial) await reaction.fetch().catch(() => null);
                                        const config = await getGuildConfig(reaction.message.guild.id);
                                                if (!config?.gateway) return;
                                                        if (config.gateway.type !== 'REACTION') return;
                                                                const configuredEmoji = (config.gateway?.settings?.REACTION?.emoji) || '✅';
                                                                        // Compare by unicode name or id
                                                                        const emojiName = reaction.emoji.name || reaction.emoji.id || String(reaction.emoji);
                                                                                if (emojiName !== configuredEmoji && String(reaction.emoji) !== configuredEmoji) return;
                                                                                        await performVerify(reaction.message.guild, user, client, 'REACTION');
            }
};
