import { getGuildConfig, updateGuildConfig } from './database.js';
import { logger } from './logger.js';

export async function incrementSuspicion(guildId, userId, tag = 'generic') {
    try {
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return false;
        const modules = cfg.modules || {};
        const trust = modules.trust || { suspicion: {} };
        trust.suspicion = trust.suspicion || {};
        trust.suspicion[userId] = trust.suspicion[userId] || { score: 0, reasons: [] };
        trust.suspicion[userId].score = (trust.suspicion[userId].score || 0) + 1;
        trust.suspicion[userId].reasons.push({ tag, at: new Date() });
        modules.trust = trust;
        await updateGuildConfig(guildId, { modules });
        logger.security(`Trust suspicion incremented for ${userId} in ${guildId}: ${tag}`);
        return true;
    } catch (err) {
        logger.warn(`incrementSuspicion error: ${err.message}`);
        return false;
    }
}

export async function logVerification(guildId, userId, details = {}) {
    try {
        const cfg = await getGuildConfig(guildId);
        if (!cfg) return false;
        const modules = cfg.modules || {};
        const trust = modules.trust || { verifications: {} };
        trust.verifications = trust.verifications || {};
        trust.verifications[userId] = trust.verifications[userId] || [];
        trust.verifications[userId].push({ ...details, at: new Date() });
        modules.trust = trust;
        await updateGuildConfig(guildId, { modules });
        logger.security(`Trust verification logged for ${userId} in ${guildId}`);
        return true;
    } catch (err) {
        logger.warn(`logVerification error: ${err.message}`);
        return false;
    }
}

export default { incrementSuspicion };
