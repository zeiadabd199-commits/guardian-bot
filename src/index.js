import { config } from 'dotenv';
import { env } from './config/environment.js';
import { startBot } from './bot.js';
import { startApi } from './api.js';

config();

async function bootstrap() {
    try {
        await startBot();
        startApi();
    } catch (error) {
        console.error('Guardian bootstrap failed:', error);
        process.exit(1);
    }
}

bootstrap();
