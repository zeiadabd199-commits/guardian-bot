import { createEmbed } from '../../utils/embedBuilder.js';
import { getGuildConfig, updateGuildConfig } from '../../core/database.js';
import { logger } from '../../core/logger.js';
import { ensureDefaultConfig } from './config.schema.js';
import { calculateGatewayTrustScore } from './trustScore.js';

// Memory caches for rate-limiting and raid detection
const rateLimitMap = new Map();
const guildAttempts = new Map();
const guildLocks = new Map();

function now() { return Date.now(); }
function pruneOld(arr, ms) { const cutoff = now() - ms; while (arr.length && arr[0] < cutoff) arr.shift(); }

async function setGatewayLock(guildId, minutes) {
    try {
        const ms = Math.max(1, minutes) * 60 * 1000;
        const unlockAt = Date.now() + ms;
        guildLocks.set(guildId, { locked: true, unlockAt });

        const cfg = await getGuildConfig(guildId);
        if (!cfg) return;
        const existing = cfg.modules?.introduce || {};
        const intro = ensureDefaultConfig(existing);
        intro.stats = intro.stats || {};
        intro.stats.gatewayLocked = true;
        intro.stats.lockUntil = unlockAt;
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, introduce: intro } });

        setTimeout(async () => {
            guildLocks.delete(guildId);
            const cfg2 = await getGuildConfig(guildId);
            if (!cfg2) return;
            const intro2 = ensureDefaultConfig(cfg2.modules?.introduce || {});
            intro2.stats.gatewayLocked = false;
            intro2.stats.lockUntil = null;
            await updateGuildConfig(guildId, { modules: { ...cfg2.modules, introduce: intro2 } });
        }, ms);
    } catch (err) {
        logger.error(`Failed to set gateway lock for ${guildId}: ${err.message}`);
    }
}

async function incrementStats(guildId, field) {
    try {
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return null;
        const existing = cfg.modules?.introduce || {};
        const intro = ensureDefaultConfig(existing);
        intro.stats = intro.stats || { totalVerified: 0, totalBlocked: 0, todayVerified: 0, todayBlocked: 0 };
        if (field === 'verified') {
            intro.stats.totalVerified = (intro.stats.totalVerified || 0) + 1;
            intro.stats.todayVerified = (intro.stats.todayVerified || 0) + 1;
        } else if (field === 'blocked') {
            intro.stats.totalBlocked = (intro.stats.totalBlocked || 0) + 1;
            intro.stats.todayBlocked = (intro.stats.todayBlocked || 0) + 1;
        }
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, introduce: intro } });
        return intro.stats;
    } catch (err) {
        logger.error(`incrementStats error: ${err.message}`);
        return null;
    }
}

/**
 * Process verification with full security engine
 */
export async function processIntroduction(params) {
    const { guild, user, channel, config } = params;
    const messageObject = params.messageObject || null;

    try {
        const cfg = await getGuildConfig(guild.id);
        if (!cfg) return { status: 'error', message: 'Failed to load configuration', emoji: config?.message?.emoji?.error };
        const introduce = ensureDefaultConfig(cfg.modules?.introduce || {});

        // Gateway lock check
        if (introduce.stats?.gatewayLocked) {
            const until = introduce.stats.lockUntil;
            if (until && Date.now() < until) {
                return { status: 'gateway_locked', message: 'Gateway temporarily locked', emoji: introduce.message?.emoji?.error };
            }
        }

        // Already verified check
        if (introduce.introducedUsers && introduce.introducedUsers.includes(user.id)) {
            return { status: 'already', message: `${user.username} already verified`, emoji: introduce.message?.emoji?.already };
        }

        // Member fetch
        const member = await guild.members.fetch(user.id).catch(() => null);

        // Bypass roles check
        if (member && Array.isArray(introduce.roles?.bypassRoles) && introduce.roles.bypassRoles.some(r => member.roles.cache.has(r))) {
            if (introduce.roles?.verifiedRoleId) {
                const vr = await guild.roles.fetch(introduce.roles.verifiedRoleId).catch(() => null);
                if (vr && !member.roles.cache.has(vr.id)) {
                    await member.roles.add(vr).catch(e => logger.error(`Failed adding bypass verified role: ${e.message}`));
                }
            }
            const updated = [...(introduce.introducedUsers || []), user.id];
            await updateGuildConfig(guild.id, { modules: { ...cfg.modules, introduce: { ...introduce, introducedUsers: updated } } });
            await incrementStats(guild.id, 'verified');
            return { status: 'success', message: 'Bypassed verification', emoji: introduce.message?.emoji?.success };
        }

        // Account age check
        const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        if (accountAgeDays < (introduce.security?.minAccountAgeDays || 0)) {
            await incrementStats(guild.id, 'blocked');
            return { status: 'blocked_account_age', message: 'Account too new', emoji: introduce.message?.emoji?.error };
        }

        // Join age check
        const joinAgeMinutes = member && member.joinedAt ? Math.floor((Date.now() - new Date(member.joinedAt).getTime()) / (1000 * 60)) : Infinity;
        if (joinAgeMinutes < (introduce.security?.minJoinMinutes || 0)) {
            await incrementStats(guild.id, 'blocked');
            return { status: 'blocked_join_age', message: 'Joined too recently', emoji: introduce.message?.emoji?.error };
        }

        // Per-user rate limit
        const rlKey = `${guild.id}:${user.id}`;
        const userArr = rateLimitMap.get(rlKey) || [];
        pruneOld(userArr, 60 * 1000);
        userArr.push(now());
        rateLimitMap.set(rlKey, userArr);
        if (userArr.length > (introduce.security?.rateLimitPerMinute || 3)) {
            const gArr = guildAttempts.get(guild.id) || [];
            pruneOld(gArr, 60 * 1000);
            gArr.push(now());
            guildAttempts.set(guild.id, gArr);
            await incrementStats(guild.id, 'blocked');
            return { status: 'blocked_spam', message: 'Rate limited', emoji: introduce.message?.emoji?.error };
        }

        // Raid detection
        const gArr = guildAttempts.get(guild.id) || [];
        pruneOld(gArr, 60 * 1000);
        gArr.push(now());
        guildAttempts.set(guild.id, gArr);
        if (introduce.security?.autoLockOnRaid && gArr.length > (introduce.security?.raidThresholdPerMinute || 15)) {
            await setGatewayLock(guild.id, introduce.security.lockDurationMinutes || 10);
            return { status: 'gateway_locked', message: 'Gateway locked due to raid', emoji: introduce.message?.emoji?.error };
        }

        // Role flow: assign new account role if needed
        if (member && introduce.roles?.newAccountRoleId && accountAgeDays < 7) {
            const nr = await guild.roles.fetch(introduce.roles.newAccountRoleId).catch(() => null);
            if (nr && !member.roles.cache.has(nr.id)) await member.roles.add(nr).catch(e => logger.error(e.message));
        }

        // Suspicious heuristic
        if (member && introduce.roles?.suspiciousRoleId && accountAgeDays < ((introduce.security?.minAccountAgeDays || 0) * 2)) {
            const sr = await guild.roles.fetch(introduce.roles.suspiciousRoleId).catch(() => null);
            if (sr && !member.roles.cache.has(sr.id)) await member.roles.add(sr).catch(e => logger.error(e.message));
        }

        // Success: assign verified and remove pending roles
        if (member && introduce.roles?.verifiedRoleId) {
            const vr = await guild.roles.fetch(introduce.roles.verifiedRoleId).catch(() => null);
            if (vr && !member.roles.cache.has(vr.id)) await member.roles.add(vr).catch(e => logger.error(e.message));
        }
        if (member) {
            if (introduce.roles?.suspiciousRoleId) {
                const sr = await guild.roles.fetch(introduce.roles.suspiciousRoleId).catch(() => null);
                if (sr && member.roles.cache.has(sr.id)) await member.roles.remove(sr).catch(e => logger.error(e.message));
            }
            if (introduce.roles?.newAccountRoleId) {
                const nr = await guild.roles.fetch(introduce.roles.newAccountRoleId).catch(() => null);
                if (nr && member.roles.cache.has(nr.id)) await member.roles.remove(nr).catch(e => logger.error(e.message));
            }
        }

        // Calculate gateway trust score
        const verificationMeta = {
            attempts: 1,
            verificationTimeMs: member && member.joinedAt ? (Date.now() - new Date(member.joinedAt).getTime()) : 0,
        };
        const trustScoreResult = calculateGatewayTrustScore(member, verificationMeta);

        // Track user and store trust score
        const updatedIntroduced = [...(introduce.introducedUsers || []), user.id];
        introduce.memberScores = introduce.memberScores || {};
        introduce.memberScores[user.id] = {
            score: trustScoreResult.score,
            risk: trustScoreResult.risk,
            calculatedAt: Date.now(),
        };
        await updateGuildConfig(guild.id, { modules: { ...cfg.modules, introduce: { ...introduce, introducedUsers: updatedIntroduced } } });
        await incrementStats(guild.id, 'verified');

        logger.info(`Gateway score for ${user.id}: ${trustScoreResult.score} (${trustScoreResult.risk})`);

        return { status: 'success', message: introduce.message?.content || 'Verified', emoji: introduce.message?.emoji?.success };
    } catch (err) {
        logger.error(`processIntroduction error: ${err.message}`);
        return { status: 'error', message: 'Internal error', emoji: config?.message?.emoji?.error };
    }
}

/**
 * Send verification message with template support, delivery modes, and logging
 */
export async function sendIntroductionMessage(channel, user, result, config, originalMessage = null) {
    try {
        const intro = ensureDefaultConfig(config || {});
        const safeResult = result || { status: 'error', message: 'No result', emoji: intro.message?.emoji?.error };

        // Template replacements
        const replacements = {
            '{user}': user.username,
            '{mention}': `<@${user.id}>`,
            '{server}': channel.guild?.name || '',
            '{accountAge}': (() => Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000*60*60*24)) + 'd')(),
            '{joinAge}': (() => {
                const m = channel.guild?.members.cache.get(user.id);
                if (!m || !m.joinedAt) return 'N/A';
                return Math.floor((Date.now() - new Date(m.joinedAt).getTime())/(1000*60)) + 'm';
            })(),
            '{guildMemberCount}': String(channel.guild?.memberCount || 0),
            '{verifiedRole}': intro.roles?.verifiedRoleId ? `<@&${intro.roles.verifiedRoleId}>` : 'None',
        };
        const apply = (s) => { if (!s) return ''; let out = String(s); Object.entries(replacements).forEach(([k,v]) => { out = out.split(k).join(v); }); return out; };

        const emojiInline = (safeResult.emoji && intro.message?.emojiMode !== 'reaction') ? `${safeResult.emoji} ` : '';
        const delivery = intro.message?.delivery || 'channel';
        const toDM = delivery === 'dm' || delivery === 'both';
        const toChannel = delivery === 'channel' || delivery === 'both';

        // Build and send message
        if (intro.message?.type === 'embed' && intro.embed?.enabled) {
            const color = (() => {
                const c = intro.embed.color || '#0099FF';
                const valid = /^#?[0-9A-Fa-f]{6}$/.test(String(c));
                return valid ? (c.startsWith('#') ? c : `#${c}`) : '#0099FF';
            })();
            const embed = {
                title: apply(intro.embed.title || 'Welcome'),
                description: apply(safeResult.message || intro.embed.description || ''),
                color: parseInt(String(color).replace('#',''),16) || 0x0099FF,
                thumbnail: intro.embed.thumbnail ? { url: intro.embed.thumbnail } : undefined,
                image: intro.embed.image ? { url: intro.embed.image } : undefined,
                footer: { text: `User: ${user.tag}` },
                timestamp: new Date().toISOString(),
            };
            if (!embed.thumbnail) delete embed.thumbnail;
            if (!embed.image) delete embed.image;
            if (toDM) await user.send({ embeds: [embed] }).catch(e => logger.warn(`DM failed: ${e.message}`));
            if (toChannel) await channel.send({ embeds: [embed] }).catch(e => logger.error(`Channel send failed: ${e.message}`));
        } else {
            const text = emojiInline + apply(safeResult.message || intro.message?.content || '');
            if (toDM) await user.send(text).catch(e => logger.warn(`DM failed: ${e.message}`));
            if (toChannel) await channel.send(text).catch(e => logger.error(`Channel send failed: ${e.message}`));
        }

        // Reaction mode
        if (intro.message?.emojiMode === 'reaction' && safeResult.emoji && originalMessage) {
            try { await originalMessage.react(safeResult.emoji); } catch (e) { logger.warn(`React failed: ${e.message}`); }
        }

        // Logging
        try {
            if (intro.logs?.enabled && intro.logs?.channelId) {
                const logChannel = channel.guild.channels.cache.get(intro.logs.channelId);
                if (logChannel) {
                    const embed = {
                        title: `Gateway Attempt - ${safeResult.status || 'unknown'}`,
                        color: safeResult.status === 'success' ? 0x00FF00 : 0xFF6600,
                        fields: [
                            { name: 'User', value: `${user.tag} (${user.id})` },
                            { name: 'Account Age', value: replacements['{accountAge}'], inline: true },
                            { name: 'Join Age', value: replacements['{joinAge}'], inline: true },
                            { name: 'Mode', value: intro.mode?.type || 'unknown', inline: true },
                            { name: 'Result', value: String(safeResult.status || 'unknown'), inline: true },
                        ],
                        timestamp: new Date().toISOString(),
                    };
                    await logChannel.send({ embeds: [embed] }).catch(e => logger.warn(`Log send failed: ${e.message}`));
                }
            }
        } catch (e) { logger.warn(`Logging error: ${e.message}`); }

    } catch (err) {
        logger.error(`sendIntroductionMessage error: ${err.message}`);
    }
}

// Admin command handlers
export async function handleEnable(interaction, channelId) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'Failed to load guild configuration' })], ephemeral: true });
        const existing = config.modules?.introduce || {};
        const ensured = ensureDefaultConfig(existing);
        ensured.enabled = true;
        ensured.channelId = channelId || ensured.channelId;
        await updateGuildConfig(guildId, { modules: { ...config.modules, introduce: ensured } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Gateway Enabled', description: `Gateway enabled${channelId ? ` for <#${channelId}>` : '.'}` })], ephemeral: true });
        logger.info(`Gateway enabled for guild ${guildId}`);
    } catch (e) { logger.error(`handleEnable error: ${e.message}`); await interaction.reply({ content: 'Error enabling gateway', ephemeral: true }); }
}

export async function handleDisable(interaction) {
    try {
        const guildId = interaction.guildId;
        const config = await getGuildConfig(guildId);
        if (!config) return interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'Failed to load guild configuration' })], ephemeral: true });
        const existing = config.modules?.introduce || {};
        const ensured = ensureDefaultConfig(existing);
        ensured.enabled = false;
        await updateGuildConfig(guildId, { modules: { ...config.modules, introduce: ensured } });
        await interaction.reply({ embeds: [createEmbed({ color: 0xFF6600, title: 'Gateway Disabled', description: 'Gateway disabled.' })], ephemeral: true });
        logger.info(`Gateway disabled for guild ${guildId}`);
    } catch (e) { logger.error(`handleDisable error: ${e.message}`); await interaction.reply({ content: 'Error disabling gateway', ephemeral: true }); }
}

export async function handleView(interaction) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ embeds: [createEmbed({ color: 0xFF0000, title: 'Error', description: 'Failed to load guild configuration' })], ephemeral: true });
        const intro = ensureDefaultConfig(cfg.modules?.introduce || {});
        const desc = `**Status:** ${intro.enabled ? '✅ Enabled' : '❌ Disabled'}\n**Channel:** ${intro.channelId ? `<#${intro.channelId}>` : 'Not set'}\n**Mode:** ${intro.mode?.type}\n**Trigger:** ${intro.mode?.triggerWord || 'N/A'}\n**Delivery:** ${intro.message?.delivery}\n**Verified Role:** ${intro.roles?.verifiedRoleId ? `<@&${intro.roles.verifiedRoleId}>` : 'None'}\n**Stats:** Total Verified: ${intro.stats?.totalVerified || 0}, Total Blocked: ${intro.stats?.totalBlocked || 0}`;
        await interaction.reply({ embeds: [createEmbed({ color: 0x0099FF, title: 'Gateway Configuration', description: desc })], ephemeral: true });
    } catch (e) { logger.error(`handleView error: ${e.message}`); await interaction.reply({ content: 'Error viewing gateway config', ephemeral: true }); }
}

export async function handleMessageSet(interaction, text) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = cfg.modules?.introduce || {};
        const intro = ensureDefaultConfig(existing);
        intro.message = { ...intro.message, content: text };
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, introduce: intro } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Message Updated', description: `Message set.` })], ephemeral: true });
    } catch (e) { logger.error(`handleMessageSet error: ${e.message}`); await interaction.reply({ content: 'Error updating message', ephemeral: true }); }
}

export async function handleEmojiSet(interaction, emojiString) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = cfg.modules?.introduce || {};
        const intro = ensureDefaultConfig(existing);
        const emojiCfg = intro.message?.emoji || {};
        if (emojiString.includes(':')) {
            const pairs = emojiString.split(/\s+/);
            for (const p of pairs) {
                const [k,v] = p.split(':'); if (k && v && ['success','already','error'].includes(k)) emojiCfg[k] = v;
            }
        } else { emojiCfg.success = emojiString; }
        intro.message.emoji = emojiCfg;
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, introduce: intro } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Emojis Updated', description: 'Emojis updated.' })], ephemeral: true });
    } catch (e) { logger.error(`handleEmojiSet error: ${e.message}`); await interaction.reply({ content: 'Error updating emojis', ephemeral: true }); }
}

export async function handleEmbedToggle(interaction, enabled) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ content: 'Failed to load configuration', ephemeral: true });
        const existing = cfg.modules?.introduce || {};
        const intro = ensureDefaultConfig(existing);
        intro.embed = { ...intro.embed, enabled };
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, introduce: intro } });
        await interaction.reply({ embeds: [createEmbed({ color: 0x00FF00, title: 'Embed Toggled', description: `Embed ${enabled ? 'enabled' : 'disabled'}` })], ephemeral: true });
    } catch (e) { logger.error(`handleEmbedToggle error: ${e.message}`); await interaction.reply({ content: 'Error toggling embed', ephemeral: true }); }
}

export async function handleStats(interaction) {
    try {
        const guildId = interaction.guildId;
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return interaction.reply({ content: 'Failed to load config', ephemeral: true });
        const intro = ensureDefaultConfig(cfg.modules?.introduce || {});
        const s = intro.stats || {};
        const desc = `**Total Verified:** ${s.totalVerified || 0}\n**Total Blocked:** ${s.totalBlocked || 0}\n**Today Verified:** ${s.todayVerified || 0}\n**Today Blocked:** ${s.todayBlocked || 0}\n**Gateway Locked:** ${s.gatewayLocked ? 'Yes' : 'No'}`;
        await interaction.reply({ embeds: [createEmbed({ color: 0x0099FF, title: 'Gateway Stats', description: desc })], ephemeral: true });
    } catch (e) { logger.error(`handleStats error: ${e.message}`); await interaction.reply({ content: 'Error fetching stats', ephemeral: true }); }
}
