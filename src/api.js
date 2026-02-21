import express from 'express';
import { env } from './config/environment.js';

export function startApi() {
    const app = express();
    app.use(express.json());

    // Basic health endpoint
    app.get('/health', (req, res) => res.json({ status: 'ok' }));

    app.listen(env.PORT, '0.0.0.0', () => {
        console.log(`Guardian API running on port ${env.PORT}`);
    });
}
