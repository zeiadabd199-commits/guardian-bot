import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function loadEvents(client) {
            const eventsPath = path.join(__dirname, "../events");
                if (!fs.existsSync(eventsPath)) return;
                    const files = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

                        // Load all events concurrently
                            const importPromises = files.map(file => {
                                        const filePath = path.join(eventsPath, file);
                                                return import(pathToFileURL(filePath).href).catch(err => {
                                                                        console.error(`[Loader] Failed to load event ${file}:`, err.message);
                                                                                        return null;
                                                });
                            });

                                const loadedEvents = await Promise.all(importPromises);
                                    let count = 0;

                                        for (const eventModule of loadedEvents) {
                                                        if (eventModule?.default?.name) {
                                                                                const event = eventModule.default;
                                                                                                if (event.once) {
                                                                                                                            client.once(event.name, (...args) => event.execute(...args, client));
                                                                                                } else {
                                                                                                                            client.on(event.name, (...args) => event.execute(...args, client));
                                                                                                }
                                                                                                                count++;
                                                        }
                                        }
                                            console.log(`[System] Successfully loaded ${count} events in parallel.`);
}