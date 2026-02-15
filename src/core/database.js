import mongoose from 'mongoose';
import { logger } from './logger.js';
import { env } from '../config/environment.js';

let isConnected = false;

const guildConfigSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
    },
    modules: {
        introduce: {
            enabled: { type: Boolean, default: false },
            channelId: { type: String, default: null },
            message: { type: String, default: '' },
            embedEnabled: { type: Boolean, default: true },
        },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const GuildConfig = mongoose.model('GuildConfig', guildConfigSchema);

export async function connectDatabase() {
    try {
        await mongoose.connect(env.MONGO_URI);
        isConnected = true;
        logger.info('Database connected successfully');
    } catch (error) {
        logger.error(`Database connection failed: ${error.message}`);
        throw error;
    }
}

export async function getGuildConfig(guildId) {
    try {
        let config = await GuildConfig.findOne({ guildId });
        if (!config) {
            config = await GuildConfig.create({ guildId });
        }
        return config;
    } catch (error) {
        logger.error(`Error fetching guild config: ${error.message}`);
        return null;
    }
}

export async function updateGuildConfig(guildId, data) {
    try {
        const config = await GuildConfig.findOneAndUpdate(
            { guildId },
            { $set: { ...data, updatedAt: new Date() } },
            { new: true, upsert: true }
        );
        return config;
    } catch (error) {
        logger.error(`Error updating guild config: ${error.message}`);
        return null;
    }
}

export function isDbConnected() {
    return isConnected;
}