import { logger } from '../../core/logger.js';
import { getGuildConfig } from '../../core/database.js';
import embedEngine from '../../core/embedEngine.js';

export default {
  name: 'welcome',
  version: '1.0.0',
  async init(client) {
    logger.info('Welcome module initialized');

    client.on('guildMemberAdd', async (member) => {
      try {
        const cfg = await getGuildConfig(member.guild.id);
        const welcomeCfg = cfg.modules?.welcome || {};
        if (!welcomeCfg || !welcomeCfg.enabled) return;
        const templateName = welcomeCfg.templateName;
        if (!templateName) return;

        const placeholders = {
          '{user}': member.user.username,
          '{mention}': `<@${member.id}>`,
          '{server}': member.guild?.name || '',
          '{date}': new Date().toLocaleString(),
        };

        const embed = await embedEngine.renderEmbed(member.guild.id, templateName, placeholders);
        if (embed && welcomeCfg.dmEnabled) {
          await member.user.send({ embeds: [embed] }).catch(() => null);
          logger.info(`Sent welcome DM using template '${templateName}' to ${member.id}`);
        }
      } catch (err) {
        logger.warn(`Welcome handler error: ${err.message}`);
      }
    });
  }
};
