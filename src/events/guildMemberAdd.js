import { Events } from 'discord.js';
import { getGuildConfig } from '../core/database.js';
import { logger } from '../core/logger.js';
import { ensureDefaultConfig } from '../modules/gateway/config.schema.js';
import gatewayModule from '../modules/gateway/index.js';

export default {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const guildConfig = await getGuildConfig(member.guild.id);
            if (!guildConfig) return;

            const gateway = ensureDefaultConfig(guildConfig.modules?.gateway || {});
            if (!gateway || !gateway.enabled) return;

            // Send welcome message
            if (gateway.welcomeMessage?.enabled) {
                await gatewayModule.sendWelcomeMessage(member, gateway);
            }

            // Assign auto-roles
            if (gateway.autoRoleOnJoin?.enabled) {
                try {
                    const panicGuard = await import('../core/panicGuard.js');
                    if (!(await panicGuard.assertNotInPanic(member.guild.id, 'GATEWAY_ROLE_ASSIGN'))) return;
                } catch (e) {
                    // non-fatal
                }
                await gatewayModule.assignAutoRoles(member, gateway);
            }

            // Optional: Send gateway instruction message in DM
            if (gateway.welcomeMessage?.dmEnabled && gateway.mode?.type === 'slash') {
                const dmContent = `Welcome to ${member.guild.name}! Please use the /verify command to verify yourself.`;
                try {
                    await member.user.send(dmContent).catch(err => {
                        logger.warn(`Failed to DM new member ${member.id} in guild ${member.guild.id}: ${err.message}`);
                    });
                } catch (err) {
                    logger.warn(`DM error: ${err.message}`);
                }
            }
        } catch (err) {
            logger.error(`Error in guildMemberAdd event: ${err.message}`);
        }
    },
};
