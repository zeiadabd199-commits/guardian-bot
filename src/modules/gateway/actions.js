import { createEmbed, GatewayEmbedBuilder, createGatewayLogEmbed, createWelcomeEmbed } from '../../utils/embedBuilder.js';
import eventBus from '../../core/eventBus.js';
import { getGuildConfig, updateGuildConfig } from '../../core/database.js';
import { logger } from '../../core/logger.js';
import panicGuard from '../../core/panicGuard.js';
import { ensureDefaultConfig } from './config.schema.js';
import { calculateGatewayTrustScore } from './trustScore.js';
import * as embedTemplates from '../embedTemplates/service.js';

// Memory caches for rate-limiting and raid detection
const rateLimitMap = new Map();
const guildAttempts = new Map();
const guildLocks = new Map();

function now() { return Date.now(); }
function pruneOld(arr, ms) { const cutoff = now() - ms; while (arr.length && arr[0] < cutoff) arr.shift(); }

// ============================================================================
// GATEWAY LOCK MANAGEMENT
// ============================================================================

export async function setGatewayLock(guildId, minutes, reason = 'Manual lock') {
    try {
        const ms = Math.max(1, minutes) * 60 * 1000;
        const unlockAt = Date.now() + ms;
        guildLocks.set(guildId, { locked: true, unlockAt, reason });

        const cfg = await getGuildConfig(guildId);
        if (!cfg) return;
        const existing = cfg.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);
        gateway.stats = gateway.stats || {};
        gateway.stats.gatewayLocked = true;
        gateway.stats.lockUntil = unlockAt;
        gateway.stats.lockReason = reason;
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, gateway } });

        setTimeout(async () => {
            guildLocks.delete(guildId);
            const cfg2 = await getGuildConfig(guildId);
            if (!cfg2) return;
            const gateway2 = ensureDefaultConfig(cfg2.modules?.gateway || {});
            gateway2.stats.gatewayLocked = false;
            gateway2.stats.lockUntil = null;
            await updateGuildConfig(guildId, { modules: { ...cfg2.modules, gateway: gateway2 } });
        }, ms);
    } catch (err) {
        logger.error(`Failed to set gateway lock for ${guildId}: ${err.message}`);
    }
}

export async function clearGatewayLock(guildId) {
    try {
        guildLocks.delete(guildId);
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return;
        const gateway = ensureDefaultConfig(cfg.modules?.gateway || {});
        // default template names (non-hardcoded embed content — templates only)
        gateway.successTemplate = gateway.successTemplate || 'verify_success';
        gateway.failTemplate = gateway.failTemplate || 'verify_fail';
        gateway.stats.gatewayLocked = false;
        gateway.stats.lockUntil = null;
        gateway.stats.lockReason = null;
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, gateway } });
        logger.info(`Gateway unlocked for ${guildId}`);
    } catch (err) {
        logger.error(`Failed to clear gateway lock: ${err.message}`);
    }
}

// ============================================================================
// STATISTICS AND TRACKING
// ============================================================================

export async function incrementStats(guildId, field) {
    try {
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return null;
        const existing = cfg.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);
        gateway.stats = gateway.stats || { totalVerified: 0, totalBlocked: 0, todayVerified: 0, todayBlocked: 0 };
        if (field === 'verified') {
            gateway.stats.totalVerified = (gateway.stats.totalVerified || 0) + 1;
            gateway.stats.todayVerified = (gateway.stats.todayVerified || 0) + 1;
        } else if (field === 'blocked') {
            gateway.stats.totalBlocked = (gateway.stats.totalBlocked || 0) + 1;
            gateway.stats.todayBlocked = (gateway.stats.todayBlocked || 0) + 1;
        }
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, gateway } });
        return gateway.stats;
    } catch (err) {
        logger.error(`incrementStats error: ${err.message}`);
        return null;
    }
}

// ============================================================================
// CORE VERIFICATION PROCESS
// ============================================================================

/**
 * Main verification processor with full security engine
 */
export async function processVerification(params) {
    const { guild, user, channel, config, system: suppliedSystem, mode } = params;
    const messageObject = params.messageObject || null;

    try {
        const cfg = await getGuildConfig(guild.id);
        if (!cfg) return { status: 'error', message: 'Failed to load configuration' };
        const gateway = ensureDefaultConfig(cfg.modules?.gateway || {});

        // Gateway lock check
        if (gateway.stats?.gatewayLocked) {
            const until = gateway.stats.lockUntil;
            if (until && Date.now() < until) {
                await incrementStats(guild.id, 'blocked');
                return { status: 'gateway_locked', message: 'Gateway temporarily locked due to raid' };
            }
        }

        // Determine active system
        let system = suppliedSystem || null;
        if (!system) {
            const wantType = mode; // mode passed from event: button,reaction,trigger,slash
            system = gateway.systems.find(s => s.enabled && ((s.type === wantType) || (s.type === 'text' && wantType === 'trigger')));
        }
        if (!system) return { status: 'error', message: 'No matching verification system' };

        // Already verified check (module-level)
        if (gateway.introducedUsers && gateway.introducedUsers.includes(user.id)) {
            return { status: 'already', message: system.alreadyVerifiedMessage || 'Already verified' };
        }

        // Member fetch
        const member = await guild.members.fetch(user.id).catch(() => null);

        // Bypass roles check (module-level bypassRoles supported)
        if (member && Array.isArray(gateway.roles?.bypassRoles) && gateway.roles.bypassRoles.some(r => member.roles.cache.has(r))) {
            // add configured verify role if present
            const addRoleId = system.verifyRoleAdd || gateway.roles?.verifiedRoleId;
            if (addRoleId) {
                const vr = await guild.roles.fetch(addRoleId).catch(() => null);
                if (vr && !member.roles.cache.has(vr.id)) {
                    if (!(await panicGuard.assertNotInPanic(guild.id, 'GATEWAY_ROLE_ASSIGN'))) return { status: 'blocked_panic', message: 'Action blocked by panic mode' };
                    await member.roles.add(vr).catch(e => logger.error(`Failed adding bypass verified role: ${e.message}`));
                }
            }
            const updated = [...(gateway.introducedUsers || []), user.id];
            await updateGuildConfig(guild.id, { modules: { ...cfg.modules, gateway: { ...gateway, introducedUsers: updated } } });
            await incrementStats(guild.id, 'verified');
            return { status: 'success', message: system.successMessage || 'Bypassed verification' };
        }

        // Account age check (module-level security)
        const sec = gateway.security || {};
        const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        if (accountAgeDays < (sec.minAccountAgeDays || 0)) {
            await incrementStats(guild.id, 'blocked');
            return { status: 'blocked_account_age', message: system.failMessage || 'Account too new' };
        }

        // Join age check
        const joinAgeMinutes = member && member.joinedAt ? Math.floor((Date.now() - new Date(member.joinedAt).getTime()) / (1000 * 60)) : Infinity;
        if (joinAgeMinutes < (sec.minJoinMinutes || 0)) {
            await incrementStats(guild.id, 'blocked');
            return { status: 'blocked_join_age', message: system.failMessage || 'Joined too recently' };
        }

        // Per-user rate limit
        const rlKey = `${guild.id}:${user.id}`;
        const userArr = rateLimitMap.get(rlKey) || [];
        pruneOld(userArr, 60 * 1000);
        userArr.push(now());
        rateLimitMap.set(rlKey, userArr);
        if (userArr.length > (sec.rateLimitPerMinute || 3)) {
            const gArr = guildAttempts.get(guild.id) || [];
            pruneOld(gArr, 60 * 1000);
            gArr.push(now());
            guildAttempts.set(guild.id, gArr);
            await incrementStats(guild.id, 'blocked');
            return { status: 'blocked_spam', message: system.failMessage || 'Rate limited' };
        }

        // Raid detection
        const gArr = guildAttempts.get(guild.id) || [];
        pruneOld(gArr, 60 * 1000);
        gArr.push(now());
        guildAttempts.set(guild.id, gArr);
        if (sec.autoLockOnRaid && gArr.length > (sec.raidThresholdPerMinute || 15)) {
            await setGatewayLock(guild.id, sec.lockDurationMinutes || 10, 'Raid detected - auto-lock');
            return { status: 'gateway_locked', message: 'Gateway locked due to raid' };
        }

        // New account and suspicious roles (legacy behavior preserved)
        if (member && gateway.roles?.newAccountRoleId && accountAgeDays < 7) {
            const nr = await guild.roles.fetch(gateway.roles.newAccountRoleId).catch(() => null);
            if (nr && !member.roles.cache.has(nr.id)) {
                if (!(await panicGuard.assertNotInPanic(guild.id, 'GATEWAY_ROLE_ASSIGN'))) return { status: 'blocked_panic', message: 'Action blocked by panic mode' };
                await member.roles.add(nr).catch(e => logger.error(e.message));
            }
        }
        if (member && gateway.roles?.suspiciousRoleId && accountAgeDays < ((sec.minAccountAgeDays || 0) * 2)) {
            const sr = await guild.roles.fetch(gateway.roles.suspiciousRoleId).catch(() => null);
            if (sr && !member.roles.cache.has(sr.id)) {
                if (!(await panicGuard.assertNotInPanic(guild.id, 'GATEWAY_ROLE_ASSIGN'))) return { status: 'blocked_panic', message: 'Action blocked by panic mode' };
                await member.roles.add(sr).catch(e => logger.error(e.message));
            }
        }

        // Assign verify role defined on the system or fallback to legacy
        if (member) {
            const addRoleId = system.verifyRoleAdd || gateway.roles?.verifiedRoleId;
            if (addRoleId) {
                const vr = await guild.roles.fetch(addRoleId).catch(() => null);
                if (vr && !member.roles.cache.has(vr.id)) {
                    if (!(await panicGuard.assertNotInPanic(guild.id, 'GATEWAY_ROLE_ASSIGN'))) return { status: 'blocked_panic', message: 'Action blocked by panic mode' };
                    await member.roles.add(vr).catch(e => logger.error(e.message));
                }
            }
        }

        // Remove pending roles on success (legacy behavior preserved)
        if (member) {
            if (gateway.roles?.suspiciousRoleId) {
                const sr = await guild.roles.fetch(gateway.roles.suspiciousRoleId).catch(() => null);
                if (sr && member.roles.cache.has(sr.id)) {
                    if (!(await panicGuard.assertNotInPanic(guild.id, 'ROLE_MODIFY'))) return { status: 'blocked_panic', message: 'Action blocked by panic mode' };
                    await member.roles.remove(sr).catch(e => logger.error(e.message));
                }
            }
            if (gateway.roles?.newAccountRoleId) {
                const nr = await guild.roles.fetch(gateway.roles.newAccountRoleId).catch(() => null);
                if (nr && member.roles.cache.has(nr.id)) {
                    if (!(await panicGuard.assertNotInPanic(guild.id, 'ROLE_MODIFY'))) return { status: 'blocked_panic', message: 'Action blocked by panic mode' };
                    await member.roles.remove(nr).catch(e => logger.error(e.message));
                }
            }
        }

        // Calculate trust score
        const verificationMeta = {
            attempts: 1,
            verificationTimeMs: member && member.joinedAt ? (Date.now() - new Date(member.joinedAt).getTime()) : 0,
        };
        const trustScoreResult = calculateGatewayTrustScore(member, verificationMeta);

        // Track user and store trust score
        const updatedIntroduced = [...(gateway.introducedUsers || []), user.id];
        gateway.memberScores = gateway.memberScores || {};
        gateway.memberScores[user.id] = {
            score: trustScoreResult.score,
            risk: trustScoreResult.risk,
            calculatedAt: Date.now(),
        };
        await updateGuildConfig(guild.id, { modules: { ...cfg.modules, gateway: { ...gateway, introducedUsers: updatedIntroduced, memberScores: gateway.memberScores } } });
        await incrementStats(guild.id, 'verified');

        logger.info(`Gateway score for ${user.id}: ${trustScoreResult.score} (${trustScoreResult.risk})`);

        try { eventBus.emit('gateway.verified', { guildId: guild.id, userId: user.id }); } catch (err) { logger.warn(`Failed to emit gateway.verified event: ${err.message}`); }

        // send welcome DM via template (DM only, no channel welcome)
        try {
            const tplName = (system && system.successTemplate) ? system.successTemplate : (gateway.successTemplate || 'verify_success');
            const rendered = await embedTemplates.renderTemplate(guild.id, tplName, { user, guild, channel: null, date: new Date() });
            if (rendered) {
                await user.send({ embeds: [rendered] }).catch(e => logger.warn(`Welcome DM failed: ${e.message}`));
            }
        } catch (e) {
            logger.error(`Welcome DM error: ${e.message}`);
        }

        // success message from system or fallback
        return { status: 'success', message: system.successMessage || 'Verified' };
    } catch (err) {
        logger.error(`processVerification error: ${err.message}`);
        return { status: 'error', message: 'Internal error' };
    }
}

// ============================================================================
// MESSAGE DELIVERY
// ============================================================================

/**
 * Send verification message with embeds, templates, and delivery modes
 */
export async function sendVerificationMessage(channel, user, result, config, originalMessage = null, system = null) {
    try {
        const gateway = ensureDefaultConfig(config || {});
        const sys = system || null;
        const safeResult = result || { status: 'error', message: 'No result' };

        // Template replacements
        const member = await channel.guild?.members.fetch(user.id).catch(() => null);
        const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000*60*60*24));
        const joinAgeMinutes = member && member.joinedAt ? Math.floor((Date.now() - new Date(member.joinedAt).getTime())/(1000*60)) : null;

        const templates = {
            '{user}': user.username,
            '{mention}': `<@${user.id}>`,
            '{guild}': channel.guild?.name || '',
            '{server}': channel.guild?.name || '',
            '{accountAge}': `${accountAgeDays}d`,
            '{joinAge}': joinAgeMinutes ? `${joinAgeMinutes}m` : 'N/A',
            '{guildMemberCount}': String(channel.guild?.memberCount || 0),
            '{verifiedRole}': (sys?.verifyRoleAdd) ? `<@&${sys.verifyRoleAdd}>` : (gateway.roles?.verifiedRoleId ? `<@&${gateway.roles.verifiedRoleId}>` : 'None'),
        };

        // Delivery decisions: allow system override via system.dmSuccessMessage or fallback to gateway.message.delivery
        const delivery = gateway.message?.delivery || 'channel';
        const toChannel = delivery === 'channel' || delivery === 'both';
        const toDM = delivery === 'dm' || delivery === 'both';

        const usePublicEmbed = gateway.message?.type === 'embed' && gateway.embedPublic?.enabled;
        const useDMEmbed = gateway.message?.type === 'embed' && gateway.embedDM?.enabled;

        // Determine if an embed template is configured for success or reject
        const successTemplate = sys?.successTemplate || gateway.successTemplate || null;
        const rejectTemplate = sys?.failTemplate || gateway.failTemplate || null;

        // Send to channel
        if (toChannel) {
            // choose message based on status and system overrides
            let channelText = safeResult.message || '';
            if (safeResult.status === 'success') channelText = sys?.successMessage || channelText || gateway.message?.content || 'Verified';
            if (safeResult.status === 'already') channelText = sys?.alreadyVerifiedMessage || channelText || 'Already verified';
            if (safeResult.status && safeResult.status.startsWith('blocked')) channelText = sys?.failMessage || channelText || 'Verification failed';
            // If a template name is configured, prefer rendering that template
            const templateName = (safeResult.status === 'success') ? successTemplate : (safeResult.status && safeResult.status.startsWith('blocked') ? rejectTemplate : null);
            if (templateName) {
                try {
                    const rendered = await embedTemplates.renderTemplate(channel.guild.id, templateName, {
                        user,
                        guild: channel.guild,
                        channel,
                        date: new Date(),
                    });
                    if (rendered) {
                        await channel.send({ embeds: [rendered] }).catch(e => logger.error(`Channel send failed: ${e.message}`));
                    } else {
                        const text = applyTemplates(channelText, templates);
                        await channel.send(text).catch(e => logger.error(`Channel send failed: ${e.message}`));
                    }
                } catch (e) {
                    logger.error(`Template render/send failed: ${e.message}`);
                    const text = applyTemplates(channelText, templates);
                    await channel.send(text).catch(err => logger.error(`Channel send failed: ${err.message}`));
                }
            } else {
                if (usePublicEmbed) {
                    const builder = new GatewayEmbedBuilder(gateway.embedPublic);
                    builder.config.description = applyTemplates(channelText, templates);
                    const embed = builder.build(templates);
                    await channel.send({ embeds: [embed] }).catch(e => logger.error(`Channel send failed: ${e.message}`));
                } else {
                    const text = applyTemplates(channelText, templates);
                    await channel.send(text).catch(e => logger.error(`Channel send failed: ${e.message}`));
                }
            }
        }

        // Send to DM
        if (toDM) {
            // For success, prefer system.dmSuccessMessage if provided
            let dmText = safeResult.message || '';
            if (safeResult.status === 'success') dmText = sys?.dmSuccessMessage || dmText || gateway.message?.content || 'Verified';
            // If success and template available, render and DM
            if (safeResult.status === 'success' && successTemplate) {
                try {
                    const rendered = await embedTemplates.renderTemplate(channel.guild.id, successTemplate, {
                        user,
                        guild: channel.guild,
                        channel,
                        date: new Date(),
                    });
                    if (rendered) {
                        await user.send({ embeds: [rendered] }).catch(e => logger.warn(`DM failed: ${e.message}`));
                    } else {
                        const text = applyTemplates(dmText, templates);
                        await user.send(text).catch(e => logger.warn(`DM failed: ${e.message}`));
                    }
                } catch (e) {
                    logger.error(`Template DM failed: ${e.message}`);
                    const text = applyTemplates(dmText, templates);
                    await user.send(text).catch(err => logger.warn(`DM failed: ${err.message}`));
                }
            } else {
                if (useDMEmbed) {
                    const builder = new GatewayEmbedBuilder(gateway.embedDM);
                    builder.config.description = applyTemplates(dmText, templates);
                    const embed = builder.build(templates);
                    await user.send({ embeds: [embed] }).catch(e => logger.warn(`DM failed: ${e.message}`));
                } else {
                    const text = applyTemplates(dmText, templates);
                    await user.send(text).catch(e => logger.warn(`DM failed: ${e.message}`));
                }
            }
        }

        // Reaction mode
        if (gateway.message?.emojiMode === 'reaction' && safeResult.emoji && originalMessage) {
            try { await originalMessage.react(safeResult.emoji); } catch (e) { logger.warn(`React failed: ${e.message}`); }
        }

        // Logging
        await logGatewayAttempt(channel.guild, user, safeResult, gateway, { accountAgeDays, joinAge: joinAgeMinutes });

    } catch (err) {
        logger.error(`sendVerificationMessage error: ${err.message}`);
    }
}

export async function logGatewayAttempt(guild, user, result, config, data = {}) {
    try {
        const gateway = ensureDefaultConfig(config || {});
        if (!gateway.logs?.enabled || !gateway.logs?.channelId) return;

        const logChannel = guild.channels.cache.get(gateway.logs.channelId);
        if (!logChannel) return;

        const embed = createGatewayLogEmbed(result.status, user, {
            accountAge: data.accountAgeDays ? `${data.accountAgeDays}d` : 'N/A',
            joinAge: data.joinAge ? `${data.joinAge}m` : 'N/A',
            mode: gateway.mode?.type || 'unknown',
        });

        await logChannel.send({ embeds: [embed] }).catch(e => logger.warn(`Log send failed: ${e.message}`));
    } catch (err) {
        logger.warn(`Logging error: ${err.message}`);
    }
}

// ============================================================================
// WELCOME MESSAGE HANDLER
// ============================================================================

export async function sendWelcomeMessage(member, config) {
    try {
        const gateway = ensureDefaultConfig(config || {});
        if (!gateway.welcomeMessage?.enabled) return;

        const templates = {
            '{user}': member.user.username,
            '{mention}': `<@${member.id}>`,
            '{server}': member.guild?.name || '',
            '{accountAge}': '0d',
            '{guildMemberCount}': String(member.guild?.memberCount || 0),
        };

        // Send to channel
        if (gateway.welcomeMessage?.channelId) {
            const channel = member.guild?.channels.cache.get(gateway.welcomeMessage.channelId);
            if (channel) {
                if (gateway.welcomeMessage.useEmbed) {
                    const embed = createWelcomeEmbed(gateway.welcomeMessage, templates);
                    await channel.send({ embeds: [embed] }).catch(e => logger.warn(`Welcome channel send failed: ${e.message}`));
                } else {
                    const text = applyTemplates(gateway.welcomeMessage.content, templates);
                    await channel.send(text).catch(e => logger.warn(`Welcome channel send failed: ${e.message}`));
                }
            }
        }

        // Send to DM
        if (gateway.welcomeMessage?.dmEnabled) {
            if (gateway.welcomeMessage.useEmbed) {
                const embed = createWelcomeEmbed(gateway.welcomeMessage, templates);
                await member.user.send({ embeds: [embed] }).catch(e => logger.warn(`Welcome DM failed: ${e.message}`));
            } else {
                const text = applyTemplates(gateway.welcomeMessage.content, templates);
                await member.user.send(text).catch(e => logger.warn(`Welcome DM failed: ${e.message}`));
            }
        }
    } catch (err) {
        logger.warn(`sendWelcomeMessage error: ${err.message}`);
    }
}

// ============================================================================
// AUTO-ROLE ASSIGNMENT
// ============================================================================

export async function assignAutoRoles(member, config) {
    try {
        const gateway = ensureDefaultConfig(config || {});
        if (!gateway.autoRoleOnJoin?.enabled || !Array.isArray(gateway.autoRoleOnJoin.roleIds)) return;

        for (const roleId of gateway.autoRoleOnJoin.roleIds) {
            const role = await member.guild?.roles.fetch(roleId).catch(() => null);
            if (role && !member.roles.cache.has(role.id)) {
                if (!(await panicGuard.assertNotInPanic(member.guild.id, 'GATEWAY_ROLE_ASSIGN'))) return;
                await member.roles.add(role).catch(e => logger.warn(`Failed to assign auto-role ${roleId}: ${e.message}`));
            }
        }
    } catch (err) {
        logger.warn(`assignAutoRoles error: ${err.message}`);
    }
}

// ============================================================================
// ADMIN COMMAND HANDLERS
// ============================================================================

function applyTemplates(text, templates = {}) {
    if (!text) return '';
    let result = String(text);
    Object.entries(templates).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
            result = result.split(key).join(String(value));
        }
    });
    return result;
}

export async function handleEnable(interaction, channelId) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'Failed to load guild configuration' })], ephemeral: true });
        const existing = config.modules?.gateway || {};
        const ensured = ensureDefaultConfig(existing);
        ensured.enabled = true;
        ensured.channelId = channelId || ensured.channelId;
        await updateGuildConfig(guildId, { modules: { ...config.modules, gateway: ensured } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Gateway Enabled', description: `Gateway enabled${channelId ? ` for <#${channelId}>` : '.'}` })], ephemeral: true });
        logger.info(`Gateway enabled for guild ${guildId}`);
    } catch (e) { logger.error(`handleEnable error: ${e.message}`); await interaction.reply({ content: 'Error enabling gateway', ephemeral: true }); }
}

export async function handleDisable(interaction) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'Failed to load guild configuration' })], ephemeral: true });
        const existing = config.modules?.gateway || {};
        const ensured = ensureDefaultConfig(existing);
        ensured.enabled = false;
        await updateGuildConfig(guildId, { modules: { ...config.modules, gateway: ensured } });
        await interaction.reply({ embeds: [createEmbed({ color: 0xFF6600, title: 'Gateway Disabled', description: 'Gateway disabled.' })], ephemeral: true });
        logger.info(`Gateway disabled for guild ${guildId}`);
    } catch (e) { logger.error(`handleDisable error: ${e.message}`); await interaction.reply({ content: 'Error disabling gateway', ephemeral: true }); }
}

export async function handleView(interaction) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'Failed to load guild configuration' })], ephemeral: true });
        const gateway = ensureDefaultConfig(cfg.modules?.gateway || {});
        const desc = `**Status:** ${gateway.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** ${gateway.channelId ? `<#${gateway.channelId}>` : 'Not set'}\n**Mode:** ${gateway.mode?.type}\n**Trigger:** ${gateway.mode?.triggerWord || 'N/A'}\n**Delivery:** ${gateway.message?.delivery}\n**Verified Role:** ${gateway.roles?.verifiedRoleId ? `<@&${gateway.roles.verifiedRoleId}>` : 'None'}\n**Stats:** Total Verified: ${gateway.stats?.totalVerified || 0}, Total Blocked: ${gateway.stats?.totalBlocked || 0}`;
        await interaction.reply({ embeds: [createEmbed({ color: 0x0099FF, title: 'Gateway Configuration', description: desc })], ephemeral: true });
    } catch (e) { logger.error(`handleView error: ${e.message}`); await interaction.reply({ content: 'Error viewing gateway config', ephemeral: true }); }
}

export async function handleStats(interaction) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ content: 'Failed to load config', ephemeral: true });
        const gateway = ensureDefaultConfig(cfg.modules?.gateway || {});
        const s = gateway.stats || {};
        const desc = `**Total Verified:** ${s.totalVerified || 0}\n**Total Blocked:** ${s.totalBlocked || 0}\n**Today Verified:** ${s.todayVerified || 0}\n**Today Blocked:** ${s.todayBlocked || 0}\n**Gateway Locked:** ${s.gatewayLocked ? 'Yes' : 'No'}`;
        await interaction.reply({ embeds: [createEmbed({ color: 0x0099FF, title: 'Gateway Stats', description: desc })], ephemeral: true });
    } catch (e) { logger.error(`handleStats error: ${e.message}`); await interaction.reply({ content: 'Error fetching stats', ephemeral: true }); }
}

// ============================================================================
// MODE HANDLERS
// ============================================================================

export async function handleModeSet(interaction, mode) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = config.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);
        gateway.mode.type = mode;
        await updateGuildConfig(guildId, { modules: { ...config.modules, gateway } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Mode Updated', description: `Verification mode set to: **${mode}**` })], ephemeral: true });
    } catch (e) { logger.error(`handleModeSet error: ${e.message}`); await interaction.reply({ content: 'Error updating mode', ephemeral: true }); }
}

export async function handleTriggerWordSet(interaction, word) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = config.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);
        gateway.mode.triggerWord = word;
        await updateGuildConfig(guildId, { modules: { ...config.modules, gateway } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Trigger Word Updated', description: `Trigger word set to: **${word}**` })], ephemeral: true });
    } catch (e) { logger.error(`handleTriggerWordSet error: ${e.message}`); await interaction.reply({ content: 'Error updating trigger word', ephemeral: true }); }
}

// ============================================================================
// SECURITY HANDLERS
// ============================================================================

export async function handleSecuritySet(interaction, field, value) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = config.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);
        if (gateway.security.hasOwnProperty(field)) {
            gateway.security[field] = value;
            await updateGuildConfig(guildId, { modules: { ...config.modules, gateway } });
            await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Security Updated', description: `${field} set to: **${value}**` })], ephemeral: true });
        } else {
            await interaction.reply({ content: `Unknown security field: ${field}`, ephemeral: true });
        }
    } catch (e) { logger.error(`handleSecuritySet error: ${e.message}`); await interaction.reply({ content: 'Error updating security', ephemeral: true }); }
}

// ============================================================================
// ROLE HANDLERS
// ============================================================================

export async function handleRoleSetVerify(interaction, role) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = config.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);
        gateway.roles.verifiedRoleId = role.id;
        await updateGuildConfig(guildId, { modules: { ...config.modules, gateway } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Role Updated', description: `Verified role set to: <@&${role.id}>` })], ephemeral: true });
    } catch (e) { logger.error(`handleRoleSetVerify error: ${e.message}`); await interaction.reply({ content: 'Error updating role', ephemeral: true }); }
}

export async function handleBypassRoleAdd(interaction, role) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = config.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);
        if (!gateway.roles.bypassRoles.includes(role.id)) {
            gateway.roles.bypassRoles.push(role.id);
            await updateGuildConfig(guildId, { modules: { ...config.modules, gateway } });
            await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Bypass Role Added', description: `<@&${role.id}> can now bypass verification` })], ephemeral: true });
        } else {
            await interaction.reply({ content: 'This role already bypasses verification', ephemeral: true });
        }
    } catch (e) { logger.error(`handleBypassRoleAdd error: ${e.message}`); await interaction.reply({ content: 'Error adding bypass role', ephemeral: true }); }
}

export async function handleBypassRoleRemove(interaction, role) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = config.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);
        gateway.roles.bypassRoles = gateway.roles.bypassRoles.filter(r => r !== role.id);
        await updateGuildConfig(guildId, { modules: { ...config.modules, gateway } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Bypass Role Removed', description: `<@&${role.id}> can no longer bypass verification` })], ephemeral: true });
    } catch (e) { logger.error(`handleBypassRoleRemove error: ${e.message}`); await interaction.reply({ content: 'Error removing bypass role', ephemeral: true }); }
}

// ============================================================================
// LOG HANDLERS
// ============================================================================

export async function handleLogsEnable(interaction, channelId) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = config.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);
        gateway.logs.enabled = true;
        gateway.logs.channelId = channelId;
        await updateGuildConfig(guildId, { modules: { ...config.modules, gateway } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Logs Enabled', description: `Logs will be sent to <#${channelId}>` })], ephemeral: true });
    } catch (e) { logger.error(`handleLogsEnable error: ${e.message}`); await interaction.reply({ content: 'Error enabling logs', ephemeral: true }); }
}

export async function handleLogsDisable(interaction) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = config.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);
        gateway.logs.enabled = false;
        await updateGuildConfig(guildId, { modules: { ...config.modules, gateway } });
        await interaction.reply({ embeds: [createEmbed({ color: 0xFF6600, title: 'Logs Disabled', description: 'Gateway logs are now disabled' })], ephemeral: true });
    } catch (e) { logger.error(`handleLogsDisable error: ${e.message}`); await interaction.reply({ content: 'Error disabling logs', ephemeral: true }); }
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

export async function handleMessageSet(interaction, text) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = cfg.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);
        gateway.message.content = text;
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, gateway } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Message Updated', description: `Message set successfully` })], ephemeral: true });
    } catch (e) { logger.error(`handleMessageSet error: ${e.message}`); await interaction.reply({ content: 'Error updating message', ephemeral: true }); }
}

// ============================================================================
// EMBED HANDLERS
// ============================================================================

export async function handleEmbedEdit(interaction, type, field, value) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = cfg.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);

        const embedKey = type === 'dm' ? 'embedDM' : 'embedPublic';
        if (!gateway[embedKey]) gateway[embedKey] = {};

        gateway[embedKey][field] = value;
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, gateway } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Embed Updated', description: `${type} embed ${field} updated successfully` })], ephemeral: true });
    } catch (e) { logger.error(`handleEmbedEdit error: ${e.message}`); await interaction.reply({ content: 'Error updating embed', ephemeral: true }); }
}

export async function handleEmbedPreview(interaction, type) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = cfg.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);

        const embedKey = type === 'dm' ? 'embedDM' : 'embedPublic';
        const embedConfig = gateway[embedKey];

        if (!embedConfig?.enabled) {
            return interaction.reply({ content: `${type} embed is disabled. Enable it first.`, ephemeral: true });
        }

        const templates = {
            '{user}': interaction.user.username,
            '{mention}': `<@${interaction.user.id}>`,
            '{server}': interaction.guild?.name || 'Server',
        };

        const builder = new GatewayEmbedBuilder(embedConfig);
        const embed = builder.build(templates);
        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) { logger.error(`handleEmbedPreview error: ${e.message}`); await interaction.reply({ content: 'Error previewing embed', ephemeral: true }); }
}

// ============================================================================
// SYSTEM MANAGEMENT HANDLERS (create/delete/list/configure)
// ============================================================================

export async function handleSystemCreate(interaction, opts = {}) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = cfg.modules?.gateway || {};
        const gateway = ensureDefaultConfig(existing);

        gateway.systems = gateway.systems || [];
        if (gateway.systems.length >= 5) return interaction.reply({ content: 'Maximum of 5 systems allowed.', ephemeral: true });

        const id = `sys_${Date.now().toString(36)}`;
        const system = {
            id,
            type: opts.type || 'button',
            channelId: opts.channelId || null,
            verifyRoleAdd: null,
            verifyRoleRemove: null,
            triggerText: opts.triggerText || null,
            reactionEmoji: opts.reactionEmoji || null,
            successMessage: opts.successMessage || 'Verified',
            failMessage: opts.failMessage || 'Verification failed',
            alreadyVerifiedMessage: opts.alreadyVerifiedMessage || 'Already verified',
            dmSuccessMessage: opts.dmSuccessMessage || null,
            enabled: true,
        };

        gateway.systems.push(system);
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, gateway } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'System Created', description: `System ${id} created (type: ${system.type})` })], ephemeral: true });
    } catch (e) { logger.error(`handleSystemCreate error: ${e.message}`); await interaction.reply({ content: 'Error creating system', ephemeral: true }); }
}

export async function handleSystemDelete(interaction, id) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const gateway = ensureDefaultConfig(cfg.modules?.gateway || {});
        const before = gateway.systems?.length || 0;
        gateway.systems = (gateway.systems || []).filter(s => s.id !== id);
        if ((gateway.systems?.length || 0) === before) return interaction.reply({ content: 'No system found with that id', ephemeral: true });
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, gateway } });
        await interaction.reply({ embeds: [createEmbed({ color: 0xFF6600, title: 'System Deleted', description: `System ${id} removed.` })], ephemeral: true });
    } catch (e) { logger.error(`handleSystemDelete error: ${e.message}`); await interaction.reply({ content: 'Error deleting system', ephemeral: true }); }
}

export async function handleSystemList(interaction) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const gateway = ensureDefaultConfig(cfg.modules?.gateway || {});
        const systems = gateway.systems || [];
        if (!systems.length) return interaction.reply({ content: 'No systems configured.', ephemeral: true });

        const lines = systems.map(s => `• **${s.id}** — type: ${s.type}, channel: ${s.channelId ? `<#${s.channelId}>` : 'Any'}, enabled: ${s.enabled ? 'Yes' : 'No'}`);
        await interaction.reply({ embeds: [createEmbed({ color: 0x0099FF, title: 'Gateway Systems', description: lines.join('\n') })], ephemeral: true });
    } catch (e) { logger.error(`handleSystemList error: ${e.message}`); await interaction.reply({ content: 'Error listing systems', ephemeral: true }); }
}

export async function handleSystemConfigure(interaction, id, field, value) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const gateway = ensureDefaultConfig(cfg.modules?.gateway || {});
        const sys = (gateway.systems || []).find(s => s.id === id);
        if (!sys) return interaction.reply({ content: 'System not found', ephemeral: true });

        // allowed fields
        const allowed = ['channelId','verifyRoleAdd','verifyRoleRemove','triggerText','reactionEmoji','successMessage','failMessage','alreadyVerifiedMessage','dmSuccessMessage','enabled'];
        if (!allowed.includes(field)) return interaction.reply({ content: `Unknown field: ${field}`, ephemeral: true });

        // boolean for enabled
        if (field === 'enabled') {
            sys.enabled = (value === 'true' || value === true);
        } else {
            sys[field] = value;
        }

        await updateGuildConfig(guildId, { modules: { ...cfg.modules, gateway } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'System Updated', description: `System ${id} updated: ${field}` })], ephemeral: true });
    } catch (e) { logger.error(`handleSystemConfigure error: ${e.message}`); await interaction.reply({ content: 'Error configuring system', ephemeral: true }); }
}

// ============================================================================
// GATEWAY LOCK HANDLERS (ADMIN MANUAL LOCK/UNLOCK)
// ============================================================================

export async function handleGatewayLock(interaction, minutes, reason) {
    try {
        const guildId = interaction.guildId;
        await setGatewayLock(guildId, minutes, reason || 'Manually locked');
        await interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Gateway Locked', description: `Gateway locked for ${minutes} minutes.\n**Reason:** ${reason}` })], ephemeral: true });
    } catch (e) { logger.error(`handleGatewayLock error: ${e.message}`); await interaction.reply({ content: 'Error locking gateway', ephemeral: true }); }
}

export async function handleGatewayUnlock(interaction) {
    try {
        const guildId = interaction.guildId;
        await clearGatewayLock(guildId);
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Gateway Unlocked', description: 'Gateway is now unlocked' })], ephemeral: true });
    } catch (e) { logger.error(`handleGatewayUnlock error: ${e.message}`); await interaction.reply({ content: 'Error unlocking gateway', ephemeral: true }); }
}
