import express from 'express';
import { env } from './config/environment.js';
import guildConfigRouter from './dashboard/routes/guildConfig.js';

export function startApi() {
    const app = express();
    app.use(express.json());

    app.use('/api/guild', guildConfigRouter);

    app.get('/health', (req, res) => res.json({ status: 'ok' }));

    app.listen(env.PORT, '0.0.0.0', () => {
        console.log(`Guardian Dashboard API running on port ${env.PORT}`);
    });
}
