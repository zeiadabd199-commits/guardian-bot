import { Events } from 'discord.js';
import { logger } from '../core/logger.js';
import { enablePanic } from './panicMode.js';
import panicGuard from '../core/panicGuard.js';

// Track recent webhook creations per guild (timestamps of created webhook ids)
const createdMap = new Map(); // guildId -> [{id, ts}]

function now() { return Date.now(); }
function prune(arr, ms) { const cutoff = now() - ms; return arr.filter(x => x.ts >= cutoff); }

export function init(client, opts = {}) {
    const WINDOW_MS = opts.windowMs || 60_000;
    const THRESHOLD = opts.threshold || 3;

    client.on(Events.WebhooksUpdate, async (channel) => {
        try {
            const guild = channel.guild;
            const guildId = guild?.id;
            if (!guildId) return;

            try {
                if (!(await panicGuard.assertNotInPanic(guildId, 'WEBHOOK_CREATE'))) return;
            } catch (e) {
                // ignore
            }

            const webhooks = await guild.fetchWebhooks();
            const prev = createdMap.get(guildId) || [];
            const nowList = prev.slice();

            // Determine new webhook ids by comparing to stored ids
            const knownIds = new Set(prev.map(p => p.id));
            const newOnes = [];
            for (const [id, hook] of webhooks) {
                if (!knownIds.has(id)) newOnes.push({ id, hook });
            }

            if (newOnes.length === 0) {
                // update known list to current set but keep timestamps for recent ones
                const keep = webhooks.map(([id]) => ({ id, ts: now() }));
                createdMap.set(guildId, keep);
                return;
            }

            // record new creations
            for (const n of newOnes) nowList.push({ id: n.id, ts: now() });
            // prune old
            const pruned = prune(nowList, WINDOW_MS);
            createdMap.set(guildId, pruned);

            const recentCount = pruned.length;
            if (recentCount > THRESHOLD) {
                // attempt to delete newly created webhooks
                for (const n of newOnes) {
                    try {
                        await n.hook.delete();
                        logger.security(`Deleted newly created webhook ${n.id} in ${guildId}`);
                    } catch (err) {
                        logger.warn(`Failed deleting webhook ${n.id}: ${err.message}`);
                    }
                }

                try {
                    await enablePanic(guildId, 'medium');
                } catch (err) {
                    logger.warn(`Failed to enable panic from webhookGuard: ${err.message}`);
                }

                logger.security('WEBHOOK ABUSE DETECTED', guildId, `recent=${recentCount}`);
            }
        } catch (err) {
            logger.warn(`webhookGuard error: ${err.message}`);
        }
    });

    logger.info('WebhookGuard initialized');
}

export default { init };
