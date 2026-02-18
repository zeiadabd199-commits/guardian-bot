import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { env } from './config/environment.js';
import { loadEvents } from './loaders/events.js';
import { loadCommands } from './loaders/commands.js';
import { loadModules } from './loaders/modules.js';
import { connectDatabase } from './core/database.js';
import { logger } from './core/logger.js';

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // REQUIRED for guildMemberAdd
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

export async function startBot() {
    try {
        await connectDatabase();
    } catch (error) {
        logger.error(`Failed to connect to database: ${error.message}`);
        throw error;
    }

    await loadEvents(client);
    await loadCommands(client);
    await loadModules(client);
    // Init anti-nuke watcher for runtime protection
    try {
        const anti = await import('./security/antiNukeWatcher.js');
        if (anti && anti.init) anti.init(client);
    } catch (err) {
        logger.warn(`Failed to initialize antiNukeWatcher: ${err.message}`);
    }
    
    await client.login(env.TOKEN);
}