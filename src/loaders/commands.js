import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import { env } from '../config/environment.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client) {
    const commands = [];
    const commandsPath = path.join(__dirname, '..', 'commands');
    if (!fs.existsSync(commandsPath)) return;

    const entries = fs.readdirSync(commandsPath);

    for (const entry of entries) {
        const entryPath = path.join(commandsPath, entry);
        const stat = fs.statSync(entryPath);

        // Only load directory/index.js files to avoid accidental command files
        if (!stat.isDirectory()) continue;

        const commandFile = path.join(entryPath, 'index.js');
        if (!fs.existsSync(commandFile)) continue;

        try {
            const commandModule = await import(pathToFileURL(commandFile).href);
            const command = commandModule.default;
            if (!command?.data || !command?.execute) continue;
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        } catch (error) {
            console.error(`[Guardian] Error loading command from ${entry}:`, error);
        }
    }

    console.log(`[Guardian] Loaded ${client.commands.size} commands.`);

    const rest = new REST({ version: '10' }).setToken(env.TOKEN);

    try {
        console.log('[Guardian] Registering guild commands...');
        await rest.put(
            Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID),
            { body: commands }
        );

        console.log('[Guardian] Guild slash commands updated.');
    } catch (error) {
        console.error('[Guardian] Command registration error:', error);
    }
}