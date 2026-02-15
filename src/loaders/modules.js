import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadModules(client) {
    const modulesPath = path.join(__dirname, '..', 'modules');
    const moduleFolders = fs.readdirSync(modulesPath);

    let loadedCount = 0;

    for (const folder of moduleFolders) {
        const moduleFile = path.join(modulesPath, folder, 'index.js');
        if (!fs.existsSync(moduleFile)) continue;

        try {
            const moduleExport = await import(pathToFileURL(moduleFile).href);
            const module = moduleExport.default;

            if (!module?.name || !module?.init) continue;

            await module.init(client);
            loadedCount++;
        } catch (error) {
            console.error(`[Guardian] Error loading module ${folder}:`, error);
        }
    }

    console.log(`[Guardian] Loaded ${loadedCount} modules.`);
}