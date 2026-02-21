import { Events } from 'discord.js';
import { getGuildConfig } from '../core/database.js';
import { logger } from '../core/logger.js';

export default {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const guildConfig = await getGuildConfig(member.guild.id);
            if (!guildConfig) return;

            // Use the configured gateway settings directly; the gateway module may be absent
            const gateway = (guildConfig.modules && guildConfig.modules.gateway) ? guildConfig.modules.gateway : {};
            if (!gateway || !gateway.enabled) return;

            // Try to dynamically import the gateway module only when needed
            let gatewayModule = null;
            try {
                gatewayModule = (await import('../modules/gateway/index.js')).default;
            } catch (e) {
                logger.warn(`Gateway module not available: ${e.message}`);
            }

            // Send welcome message (if module available and feature enabled)
            if (gateway.welcomeMessage?.enabled && gatewayModule?.sendWelcomeMessage) {
                await gatewayModule.sendWelcomeMessage(member, gateway).catch(err => logger.warn(`sendWelcomeMessage failed: ${err?.message || err}`));
            }

            // Assign auto-roles (respect panicGuard)
            if (gateway.autoRoleOnJoin?.enabled && gatewayModule?.assignAutoRoles) {
                try {
                    const panicGuard = await import('../core/panicGuard.js');
                    if (!(await panicGuard.default.assertNotInPanic(member.guild.id, 'GATEWAY_ROLE_ASSIGN'))) return;
                } catch (e) {
                    // non-fatal; continue to attempt role assignment if module supports it
                }
                await gatewayModule.assignAutoRoles(member, gateway).catch(err => logger.warn(`assignAutoRoles failed: ${err?.message || err}`));
            }

            // Optional: Send gateway instruction message in DM (fallback checks)
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
