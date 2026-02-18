import mongoose from 'mongoose';
import { logger } from '../core/logger.js';

const SecurityStateSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    panicLevel: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now },
});

const SecurityState = mongoose.models.SecurityState || mongoose.model('SecurityState', SecurityStateSchema, 'security_state');

export async function enablePanic(guildId, level = 'light') {
    try {
        await SecurityState.findOneAndUpdate(
            { guildId },
            { $set: { panicLevel: level, updatedAt: new Date() } },
            { upsert: true, new: true }
        );
        logger.security(`Panic mode enabled for ${guildId} (level=${level})`);
        return true;
    } catch (err) {
        logger.warn(`enablePanic DB error for ${guildId}: ${err.message}`);
        return false;
    }
}

export async function disablePanic(guildId) {
    try {
        await SecurityState.findOneAndUpdate(
            { guildId },
            { $set: { panicLevel: null, updatedAt: new Date() } },
            { upsert: true }
        );
        logger.security(`Panic mode disabled for ${guildId}`);
        return true;
    } catch (err) {
        logger.warn(`disablePanic DB error for ${guildId}: ${err.message}`);
        return false;
    }
}

export async function isPanicActive(guildId) {
    try {
        const doc = await SecurityState.findOne({ guildId }).lean();
        if (!doc || !doc.panicLevel) return false;
        return true;
    } catch (err) {
        logger.warn(`isPanicActive DB error for ${guildId}: ${err.message}`);
        return false;
    }
}

export default {
    enablePanic,
    disablePanic,
    isPanicActive,
};
