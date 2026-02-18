import eventBus from '../../core/eventBus.js';
import { logger } from '../../core/logger.js';
import { getGuildConfig, updateGuildConfig } from '../../core/database.js';

export default {
  name: 'trust',
  version: '1.0.0',
  async init(client) {
    logger.info('Trust module initialized');

    eventBus.onEvent('gateway.verified', async (data) => {
      try {
        const { guildId, userId } = data || {};
        if (!guildId || !userId) return;

        const cfg = await getGuildConfig(guildId);
        const trust = (cfg.modules && cfg.modules.trust) ? cfg.modules.trust : { scores: {} };
        trust.scores = trust.scores || {};
        const current = trust.scores[userId] || 0;
        trust.scores[userId] = current + 1;
        await updateGuildConfig(guildId, { modules: { ...cfg.modules, trust } });
        logger.info(`Increased trust for ${userId} in ${guildId} to ${trust.scores[userId]}`);
      } catch (err) {
        logger.warn(`Trust handler error: ${err.message}`);
      }
    });
  }
};
