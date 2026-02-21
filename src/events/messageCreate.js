import { Events } from 'discord.js';
import { performVerify } from '../core/gatewayLogic.js';
import { getGuildConfig } from '../core/database.js';
export default {
        name: Events.MessageCreate,
            async execute(message, client) {
                        if (message.author.bot || !message.guild) return;
                                const config = await getGuildConfig(message.guild.id);
                                        if (config?.gateway?.type === 'TRIGGER') {
                                                        const trigger = (config.gateway.triggerWord || 'verify').toLowerCase();
                                                                    if (message.content.trim().toLowerCase() === trigger) {
                                                                                        message.delete().catch(() => null);
                                                                                                        const result = await performVerify(message.guild, message.author, client, 'TRIGGER');
                                                                                                                        if (result.ok) {
                                                                                                                                                const reply = await message.channel.send(`${message.author}, verification successful!`).catch(() => null);
                                                                                                                                                                    if (reply) setTimeout(() => reply.delete().catch(() => null), 5000);
                                                                                                                        }
                                                                    }
                                        }
            }
};