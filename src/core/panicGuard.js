import { logger } from './logger.js';
import { getPanicLevel } from '../security/panicMode.js';

/**
 * Central panic guard. Returns true if action is allowed, false if blocked.
 */
export async function assertNotInPanic(guildId, actionType) {
    try {
        const level = await getPanicLevel(guildId);
        if (!level) return true; // no panic

        const L = (level || '').toLowerCase();

        if (L === 'full') {
            logger.security('PANIC BLOCKED', guildId, actionType);
            return false;
        }

        if (L === 'medium') {
            const blocked = new Set(['ROLE_MODIFY', 'CHANNEL_DELETE', 'WEBHOOK_CREATE', 'PERMISSION_UPDATE']);
            if (blocked.has(actionType)) {
                logger.security('PANIC BLOCKED', guildId, actionType);
                return false;
            }
            return true;
        }

        if (L === 'light') {
            // light blocks only bulk/mass operations. callers should pass a MASS/BULK variant for bulk ops.
            if (String(actionType).includes('MASS') || String(actionType).includes('BULK')) {
                logger.security('PANIC BLOCKED', guildId, actionType);
                return false;
            }
            return true;
        }

        return true;
    } catch (err) {
        // Do not crash or block on errors — default allow
        logger.warn(`panicGuard error for ${guildId}: ${err.message}`);
        return true;
    }
}

export default { assertNotInPanic };
