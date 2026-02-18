import { getGuildConfig, updateGuildConfig } from '../core/database.js';
import { logger } from '../core/logger.js';

const panicStates = new Map(); // guildId -> { active: bool, level, until }

export async function enablePanic(guildId, level = 'light', durationMinutes = 30) {
    const until = Date.now() + Math.max(1, durationMinutes) * 60 * 1000;
    panicStates.set(guildId, { active: true, level, until });
    try {
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return;
        const existing = cfg.modules || {};
        existing.security = existing.security || {};
        existing.security.panic = { active: true, level, until };
        await updateGuildConfig(guildId, { modules: existing });
    } catch (err) {
        logger.warn(`Failed persisting panic state for ${guildId}: ${err.message}`);
    }
    logger.security(`Panic mode enabled for ${guildId} (level=${level})`);
}

export async function disablePanic(guildId) {
    panicStates.delete(guildId);
    try {
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return;
        const existing = cfg.modules || {};
        existing.security = existing.security || {};
        existing.security.panic = { active: false };
        await updateGuildConfig(guildId, { modules: existing });
    } catch (err) {
        logger.warn(`Failed clearing panic state for ${guildId}: ${err.message}`);
    }
    logger.security(`Panic mode disabled for ${guildId}`);
}

export function isPanicActive(guildId) {
    const s = panicStates.get(guildId);
    if (!s) return false;
    if (s.until && Date.now() > s.until) {
        panicStates.delete(guildId);
        return false;
    }
    return !!s.active;
}

export default {
    enablePanic,
    disablePanic,
    isPanicActive,
};
