import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { env } from './config/environment.js';
import { loadEvents } from './loaders/events.js';
import { loadCommands } from './loaders/commands.js';
import { loadModules } from './loaders/modules.js';

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

export async function startBot() {
    await loadEvents(client);
    await loadCommands(client);
    await loadModules(client);
    
    await client.login(env.TOKEN);
}
