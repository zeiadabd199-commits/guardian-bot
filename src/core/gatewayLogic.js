import { getGuildConfig, updateUserConfig } from './database.js';
import { createGatewayEmbed } from '../utils/embedBuilder.js';
import { logger } from './logger.js';
export async function performVerify(guild, user, client, mode = 'UNKNOWN') {
        try {
                    const config = await getGuildConfig(guild.id);
                            if (!config || !config.gateway?.verifiedRoleId) return { ok: false, reason: 'not_configured' };
                                    const member = await guild.members.fetch(user.id).catch(() => null);
                                            if (!member) return { ok: false, reason: 'not_found' };
                                                    const roleId = config.gateway.verifiedRoleId;
                                                            const already = member.roles.cache.has(roleId);
                                                                    if (!already) await member.roles.add(roleId, `Gateway: ${mode}`).catch(() => null);
                                                                            await updateUserConfig(user.id, guild.id, { 'gateway.isVerified': true, 'gateway.verifiedAt': new Date() });
                                                                                    try { await user.send({ embeds: [createGatewayEmbed(config.gateway || {}, 'You are now verified. Welcome to the server! Please read the rules.')] }); } catch (e) { logger.info(`DM closed for ${user.id}`); }
                                                                                            return { ok: true, already };
        } catch (error) { logger.error(`Verify error: ${error.message}`); return { ok: false }; }
}
