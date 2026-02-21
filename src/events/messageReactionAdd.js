import { Events } from 'discord.js';
import { performVerify } from '../core/gatewayLogic.js';
import { getGuildConfig } from '../core/database.js';
export default {
        name: Events.MessageReactionAdd,
            async execute(reaction, user, client) {
                        if (user.bot || !reaction.message.guild) return;
                                if (reaction.partial) await reaction.fetch().catch(() => null);
                                        if (reaction.emoji.name !== '✅') return;
                                                const config = await getGuildConfig(reaction.message.guild.id);
                                                        if (config?.gateway?.type === 'REACTION') {
                                                                        await performVerify(reaction.message.guild, user, client, 'REACTION');
                                                        }
            }
};
