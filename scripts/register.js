import { config } from 'dotenv';
config();
import { loadCommands } from '../src/loaders/commands.js';

(async () => {
    try {
        // Minimal fake client with commands map used by loader
        const client = { commands: new Map() };
        await loadCommands(client);
        console.log('Register script finished');
        process.exit(0);
    } catch (err) {
        console.error('Register script failed:', err);
        process.exit(1);
    }
})();
