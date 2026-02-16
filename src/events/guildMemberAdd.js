++ 
import { Events } from 'discord.js';
import { getGuildConfig } from '../core/database.js';
import { logger } from '../core/logger.js';
import { ensureDefaultConfig } from '../modules/introduce/config.schema.js';

export default {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const guildConfig = await getGuildConfig(member.guild.id);
            if (!guildConfig) return;

            const introduce = ensureDefaultConfig(guildConfig.modules?.introduce || {});
            if (!introduce || !introduce.enabled) return;

            // Assign pending role if configured
            if (introduce.roles?.pendingRoleId) {
                const botMember = member.guild.members.me;
                if (!botMember || !botMember.permissions.has?.('ManageRoles')) {
                    logger.warn(`Bot lacks ManageRoles in guild ${member.guild.id}; cannot assign pending role`);
                } else {
                    const pending = await member.guild.roles.fetch(introduce.roles.pendingRoleId).catch(() => null);
                    if (pending) {
                        await member.roles.add(pending).catch(err => logger.warn(`Failed to add pending role to ${member.id}: ${err.message}`));
                    } else {
                        logger.warn(`Pending role ${introduce.roles.pendingRoleId} not found in guild ${member.guild.id}`);
                    }
                }
            }

            // Send DM with instructions
            const dmContent = introduce.message?.dm || `Please type the verification word in the verify channel.`;
            await member.send(dmContent).catch(err => {
                logger.warn(`Failed to DM new member ${member.id} in guild ${member.guild.id}: ${err.message}`);
            });
        } catch (err) {
            logger.error(`Error in guildMemberAdd event: ${err.message}`);
        }
    },
};
