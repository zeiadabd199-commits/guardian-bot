import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';
import { pathToFileURL } from 'url';
import { env } from '../config/environment.js';

export async function loadCommands(client) {
  const commands = [];
    const commandsPath = path.join(process.cwd(), 'src', 'commands');
    const files = fs.readdirSync(commandsPath);

    for (const file of files) {
        const filePath = path.join(commandsPath, file);
        const stat = fs.statSync(filePath);

        let commandFile = null;

        if (stat.isDirectory()) {
            // Load from folder/index.js
            commandFile = path.join(filePath, 'index.js');
        } else if (file.endsWith('.js')) {
            // Load directly from .js file
            commandFile = filePath;
        }

        if (!commandFile || !fs.existsSync(commandFile)) continue;

        try {
            const commandModule = await import(pathToFileURL(commandFile).href);
            const command = commandModule.default;

            if (!command?.data || !command?.execute) continue;

            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        } catch (error) {
            console.error(`[Guardian] Error loading command from ${file}:`, error);
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