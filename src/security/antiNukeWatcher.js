import { Events } from 'discord.js';
import { logger } from '../core/logger.js';
import panicMode from './panicMode.js';

// Simple spike detection per guild per event type
const maps = {
    channelDelete: new Map(),
    roleDelete: new Map(),
    roleUpdate: new Map(),
    webhookCreate: new Map(),
};

function now() { return Date.now(); }
function prune(arr, ms) { const cutoff = now() - ms; while (arr.length && arr[0] < cutoff) arr.shift(); }

function record(map, guildId) {
    const arr = map.get(guildId) || [];
    prune(arr, 10_000);
    arr.push(now());
    map.set(guildId, arr);
    return arr.length;
}

async function panicLock(guildId, reason) {
    try {
        await panicMode.enablePanic(guildId, 'medium', 15);
        logger.security(`Anti-nuke panicLock triggered for ${guildId}: ${reason}`);
    } catch (err) {
        logger.error(`panicLock error: ${err.message}`);
    }
}

export function init(client, opts = {}) {
    const CHANNEL_THRESHOLD = opts.channelThreshold || 5; // 5 deletions within window
    const ROLE_THRESHOLD = opts.roleThreshold || 5;
    const ROLE_UPDATE_THRESHOLD = opts.roleUpdateThreshold || 6;

    client.on(Events.ChannelDelete, async (channel) => {
        try {
            const guildId = channel.guild?.id;
            if (!guildId) return;
            const count = record(maps.channelDelete, guildId);
            if (count >= CHANNEL_THRESHOLD) await panicLock(guildId, `channelDelete spike: ${count}`);
        } catch (err) {
            logger.warn(`channelDelete watcher error: ${err.message}`);
        }
    });

    client.on(Events.GuildRoleDelete, async (role) => {
        try {
            const guildId = role.guild?.id;
            if (!guildId) return;
            const count = record(maps.roleDelete, guildId);
            if (count >= ROLE_THRESHOLD) await panicLock(guildId, `roleDelete spike: ${count}`);
        } catch (err) {
            logger.warn(`roleDelete watcher error: ${err.message}`);
        }
    });

    client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
        try {
            const guildId = newRole.guild?.id;
            if (!guildId) return;
            // Detect permission escalations
            const oldPerm = oldRole.permissions.bitfield;
            const newPerm = newRole.permissions.bitfield;
            if (oldPerm !== newPerm) {
                const count = record(maps.roleUpdate, guildId);
                if (count >= ROLE_UPDATE_THRESHOLD) await panicLock(guildId, `rolePermissionUpdate spike: ${count}`);
            }
        } catch (err) {
            logger.warn(`roleUpdate watcher error: ${err.message}`);
        }
    });

    // webhookCreate is not a separate event in discord.js; use webhookUpdate which fires on create/update/delete
    client.on(Events.WebhooksUpdate, async (channel) => {
        try {
            const guildId = channel.guild?.id;
            if (!guildId) return;
            const arr = maps.webhookCreate.get(guildId) || [];
            prune(arr, 60_000);
            arr.push(now());
            maps.webhookCreate.set(guildId, arr);
            if (arr.length > (opts.webhookThreshold || 3)) {
                // disable webhook usage by enabling panic and persisting a flag
                await panicLock(guildId, `webhookCreate rate limit exceeded: ${arr.length}`);
                logger.security(`Webhook abuse detected in ${guildId} — auto-disabled webhook actions`);
            }
        } catch (err) {
            logger.warn(`webhook watcher error: ${err.message}`);
        }
    });

    logger.info('AntiNukeWatcher initialized');
}

export default { init };
