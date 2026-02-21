import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function loadCommands(client) {
      const commandsPath = path.join(__dirname, "../commands");
        if (!fs.existsSync(commandsPath)) return;
          const folders = fs.readdirSync(commandsPath);

            // Load all commands concurrently
              const importPromises = folders.map(folder => {
                    const commandPath = path.join(commandsPath, folder, "index.js");
                        return import(pathToFileURL(commandPath).href).catch(err => {
                                    console.error(`[Loader] Failed to load command ${folder}:`, err.message);
                                            return null;
                        });
              });

                const loadedCommands = await Promise.all(importPromises);
                  let count = 0;

                    for (const commandModule of loadedCommands) {
                            if (commandModule?.default?.data) {
                                        client.commands.set(commandModule.default.data.name, commandModule.default);
                                                count++;
                            }
                    }
                      console.log(`[System] Successfully loaded ${count} commands in parallel.`);
}