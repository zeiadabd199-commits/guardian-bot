import { Router } from 'express';

const router = Router();

router.get('/:guildId', (req, res) => {
    res.json({ guildId: req.params.guildId, config: {} });
});

router.post('/:guildId', (req, res) => {
    res.json({ success: true });
});

export default router;
