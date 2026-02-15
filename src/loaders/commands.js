import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';
import { pathToFileURL } from 'url';
import { env } from '../config/environment.js';

export async function loadCommands(client) {
  const commands = [];
  const commandsPath = path.join(process.cwd(), 'src', 'commands');
  const commandFolders = fs.readdirSync(commandsPath);

  client.commands = new Map();

  for (const folder of commandFolders) {
    const commandFile = path.join(commandsPath, folder, 'index.js');
    if (!fs.existsSync(commandFile)) continue;

    const commandModule = await import(pathToFileURL(commandFile).href);
    const command = commandModule.default;

    if (!command?.data || !command?.execute) continue;

    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }

  console.log(`[Guardian] Loaded ${client.commands.size} commands.`);

  const rest = new REST({ version: '10' }).setToken(env.TOKEN);

  try {
    console.log('[Guardian] Clearing GLOBAL commands...');
    await rest.put(
      Routes.applicationCommands(env.CLIENT_ID),
      { body: [] }
    );

    console.log('[Guardian] Clearing GUILD commands...');
    await rest.put(
      Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID),
      { body: [] }
    );

    console.log('[Guardian] Registering new guild commands...');
    await rest.put(
      Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID),
      { body: commands }
    );

    console.log('[Guardian] Slash commands refreshed.');
  } catch (error) {
    console.error(error);
  }
}