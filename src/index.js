import { config } from 'dotenv';
import { env } from './config/environment.js';
import { startBot, client } from './bot.js';
import { startApi } from './api.js';

config();

async function bootstrap() {
    try {
        await startBot();
        // After bot started, run a role-hierarchy safety check when ready
        client.once('ready', async () => {
            try {
                const { logger } = await import('./core/logger.js');
                const { getGuildConfig } = await import('./core/database.js');
                for (const [guildId, guild] of client.guilds.cache) {
                    try {
                        const botMember = await guild.members.fetch(client.user.id).catch(() => null);
                        if (!botMember) continue;

                        // Owner highest role position
                        const ownerMember = guild.members.cache.get(guild.ownerId) || await guild.members.fetch(guild.ownerId).catch(() => null);
                        const ownerPos = ownerMember ? (ownerMember.roles.highest.position || 0) : Infinity;
                        const botPos = botMember.roles.highest.position || 0;

                        if (botPos >= ownerPos) {
                            try {
                                const { updateGuildConfig } = await import('./core/database.js');
                                const cfg = await getGuildConfig(guildId);
                                const modules = (cfg && cfg.modules) ? cfg.modules : {};
                                modules.security = modules.security || {};
                                modules.security.roleManagementDisabled = true;
                                modules.security.destructiveActionsDisabled = true;
                                await updateGuildConfig(guildId, { modules });
                            } catch (e) {
                                logger.warn(`Failed to persist unsafe-hierarchy for ${guildId}: ${e.message}`);
                            }
                            logger.security('UNSAFE ROLE HIERARCHY DETECTED', guildId);
                            continue;
                        }

                        // Check configured roles that bot may modify (gateway module)
                        const cfg = await getGuildConfig(guildId);
                        const gateway = (cfg && cfg.modules && cfg.modules.gateway) ? cfg.modules.gateway : null;
                        const roleIds = new Set();
                        if (gateway) {
                            const g = gateway;
                            if (g.roles?.verifiedRoleId) roleIds.add(g.roles.verifiedRoleId);
                            if (g.roles?.suspiciousRoleId) roleIds.add(g.roles.suspiciousRoleId);
                            if (g.roles?.newAccountRoleId) roleIds.add(g.roles.newAccountRoleId);
                            if (Array.isArray(g.roles?.bypassRoles)) g.roles.bypassRoles.forEach(r => roleIds.add(r));
                        }

                        for (const rid of roleIds) {
                            try {
                                const role = await guild.roles.fetch(rid).catch(() => null);
                                if (!role) continue;
                                if (!(botPos > role.position)) {
                                    try {
                                        const { updateGuildConfig } = await import('./core/database.js');
                                        const cfg = await getGuildConfig(guildId);
                                        const modules = (cfg && cfg.modules) ? cfg.modules : {};
                                        modules.security = modules.security || {};
                                        modules.security.roleManagementDisabled = true;
                                        modules.security.destructiveActionsDisabled = true;
                                        await updateGuildConfig(guildId, { modules });
                                    } catch (e) {
                                        logger.warn(`Failed to persist unsafe-hierarchy for ${guildId}: ${e.message}`);
                                    }
                                    logger.security('UNSAFE ROLE HIERARCHY DETECTED', guildId);
                                    break;
                                }
                            } catch (err) {
                                // continue
                            }
                        }
                    } catch (err) {
                        // ignore per-guild errors
                    }
                }
            } catch (err) {
                console.error('Role hierarchy check failed:', err.message);
            }
        });
        startApi();
    } catch (error) {
        console.error('Guardian bootstrap failed:', error);
        process.exit(1);
    }
}

bootstrap();
