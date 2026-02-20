import { logger } from '../../core/logger.js';
import { getGuildConfig, updateGuildConfig } from '../../core/database.js';
import { assertNotInPanic } from '../../core/panicGuard.js';
import * as embedEngine from '../../core/embedEngine.js';
import * as trustSvc from '../../core/trustService.js';
import { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, StringSelectMenuBuilder } from 'discord.js';

  const DEFAULTS = {
    enabled: false,
    slots: {
      A: { enabled: false, channelId: null, templates: { success: null, fail: null, exists: null }, roleId: null },
      B: { enabled: false, channelId: null, triggerText: '!verify', emojis: ['✅', '❌', '🔁'], templates: { success: null, fail: null, exists: null }, roleId: null },
      C: { enabled: false, channelId: null, templates: { success: null, fail: null, exists: null }, roleId: null },
      D: { enabled: false, channelId: null, attachMessageId: null, emojis: ['✅', '❌', '🔁'], templates: { success: null, fail: null, exists: null }, roleId: null },
    }
  };

function ensureConfig(cfg) {
  if (!cfg) return JSON.parse(JSON.stringify(DEFAULTS));
  const out = Object.assign({}, DEFAULTS, cfg);
  out.slots = Object.assign({}, DEFAULTS.slots, cfg.slots || {});
  return out;
}

async function saveConfig(guildId, cfg) {
  const current = await getGuildConfig(guildId);
  const modules = current.modules || {};
  modules.gateway_v4 = cfg;
  await updateGuildConfig(guildId, { modules });
}

async function processVerification({ guild, user, channel, system, chosenState }) {
  // chosenState: 'success' | 'fail' | 'exists' (mapped from emoji)
  try {
    const member = await guild.members.fetch(user.id).catch(() => null);
    const guildId = guild.id;
    const cfgObj = await getGuildConfig(guildId);
    const cfg = ensureConfig(cfgObj.modules?.gateway_v4 || {});

    const slot = system || cfg.slots.B; // default to B if not specified
    const roleId = slot.roleId;

    const already = member && roleId ? member.roles.cache.has(roleId) : false;

    if (already) {
      return { state: 'exists', templateId: slot.templates.exists || null };
    }

    if (chosenState === 'success') {
      // check panic guard before role modification
      const ok = await assertNotInPanic(guildId, 'ROLE_MODIFY');
      if (!ok) return { state: 'panic', reason: 'panic_active' };

      if (member && roleId) {
        await member.roles.add(roleId).catch(err => logger.warn(`role add failed: ${err.message}`));
      }

      // Try to call trust logging if available
      try {
        if (typeof trustSvc.logVerification === 'function') {
          await trustSvc.logVerification(guildId, user.id, { slot: 'B', template: slot.templates.success || null });
        } else if (typeof trustSvc.incrementSuspicion === 'function') {
          // no logVerification available — as a fallback we increment a trust marker (no-op semantic)
          await trustSvc.incrementSuspicion(guildId, user.id, 'verified');
        }
      } catch (err) {
        logger.warn(`trust logging failed: ${err.message}`);
      }

      return { state: 'success', templateId: slot.templates.success || null };
    }

    // failed verification
    if (chosenState === 'fail') {
      // log attempt
      logger.security && logger.security(`Verification failed for ${user.id} in ${guild.id}`);
      return { state: 'fail', templateId: slot.templates.fail || null };
    }

    return { state: 'unknown' };
  } catch (err) {
    logger.error(`processVerification error: ${err.message}`);
    return { state: 'error', reason: err.message };
  }
}

export default {
  name: 'gateway_v4',
  version: '4.0.0',
  async init(client) {
    logger.info('Gateway v4 module initialized');

    // Trigger slot: watch for trigger messages and add reactions
    client.on('messageCreate', async (message) => {
      try {
        if (message.author?.bot) return;
        if (!message.guild) return;

        const guildId = message.guild.id;
        const cfgObj = await getGuildConfig(guildId);
        const cfg = ensureConfig(cfgObj.modules?.gateway_v4 || {});
        if (!cfg.enabled) return;

        const slotB = cfg.slots.B;
        if (!slotB || !slotB.enabled) return;
        if (slotB.channelId && slotB.channelId !== message.channelId) return;

        const content = (message.content || '').trim();
        if (!content) return;

        if (content.toLowerCase() === (slotB.triggerText || '!verify').toLowerCase()) {
          // add three reactions representing success, fail, exists
          for (const e of (slotB.emojis || ['✅', '❌', '🔁'])) {
            try { await message.react(e); } catch (err) { logger.warn(`react add failed: ${err.message}`); }
          }
        }
      } catch (err) {
        logger.error(`gateway_v4 messageCreate error: ${err.message}`);
      }
    });

    // Reaction handler: map emoji to states and process
    client.on('messageReactionAdd', async (reaction, user) => {
      try {
        if (user.bot) return;
        const message = reaction.message;
        if (!message || !message.guild) return;

        const guildId = message.guild.id;
        const cfgObj = await getGuildConfig(guildId);
        const cfg = ensureConfig(cfgObj.modules?.gateway_v4 || {});
        if (!cfg.enabled) return;

        // First: check Slot B trigger reactions
        const slotB = cfg.slots.B;
        if (slotB && slotB.enabled && (!slotB.channelId || slotB.channelId === message.channelId)) {
          const emojis = slotB.emojis || ['✅', '❌', '🔁'];
          const name = reaction.emoji?.name || reaction.emoji?.toString();
          let chosen = null;
          if (name === emojis[0]) chosen = 'success';
          else if (name === emojis[1]) chosen = 'fail';
          else if (name === emojis[2]) chosen = 'exists';
          if (chosen) {
            const result = await processVerification({ guild: message.guild, user, channel: message.channel, system: slotB, chosenState: chosen });
            // render template if present
            if (result.templateId) {
              const placeholders = {
                '{user}': user.username,
                '{mention}': `<@${user.id}>`,
                '{server}': message.guild.name,
                '{memberCount}': String(message.guild.memberCount),
              };
              const emb = await embedEngine.renderEmbed(guildId, result.templateId, placeholders).catch(() => null);
              if (emb) {
                try { await message.channel.send({ embeds: [emb] }); } catch (e) { logger.warn(`send embed failed: ${e.message}`); }
              }
            } else {
              if (result.state === 'success') {
                try { await message.channel.send(`${user} verified successfully.`); } catch (e) {}
              } else if (result.state === 'fail') {
                try { await message.channel.send(`${user}, verification failed.`); } catch (e) {}
              } else if (result.state === 'exists') {
                try { await message.channel.send(`${user}, you are already verified.`); } catch (e) {}
              }
            }
            return;
          }
        }

        // Next: check Slot D (attach mode) if configured
        const slotD = cfg.slots.D;
        if (slotD && slotD.enabled && (!slotD.channelId || slotD.channelId === message.channelId)) {
          // if attachMessageId is set, only accept reactions on that message
          if (slotD.attachMessageId && message.id !== slotD.attachMessageId) return;
          const emojis = slotD.emojis || ['✅', '❌', '🔁'];
          const name = reaction.emoji?.name || reaction.emoji?.toString();
          let chosenD = null;
          if (name === emojis[0]) chosenD = 'success';
          else if (name === emojis[1]) chosenD = 'fail';
          else if (name === emojis[2]) chosenD = 'exists';
          if (!chosenD) return;

          const resD = await processVerification({ guild: message.guild, user, channel: message.channel, system: slotD, chosenState: chosenD });
          if (resD.templateId) {
            const placeholders = {
              '{user}': user.username,
              '{mention}': `<@${user.id}>`,
              '{server}': message.guild.name,
              '{memberCount}': String(message.guild.memberCount),
            };
            const emb = await embedEngine.renderEmbed(guildId, resD.templateId, placeholders).catch(() => null);
            if (emb) { try { await message.channel.send({ embeds: [emb] }); } catch (e) { logger.warn(`send embed failed: ${e.message}`); } }
          }
          return;
        }

        // render template if present
        if (result.templateId) {
          const placeholders = {
            '{user}': user.username,
            '{mention}': `<@${user.id}>`,
            '{server}': message.guild.name,
            '{memberCount}': String(message.guild.memberCount),
          };
          const emb = await embedEngine.renderEmbed(guildId, result.templateId, placeholders).catch(() => null);
          if (emb) {
            try { await message.channel.send({ embeds: [emb] }); } catch (e) { logger.warn(`send embed failed: ${e.message}`); }
          }
        } else {
          // fallback text
          if (result.state === 'success') {
            try { await message.channel.send(`${user} verified successfully.`); } catch (e) {}
          } else if (result.state === 'fail') {
            try { await message.channel.send(`${user}, verification failed.`); } catch (e) {}
          } else if (result.state === 'exists') {
            try { await message.channel.send(`${user}, you are already verified.`); } catch (e) {}
          }
        }
      } catch (err) {
        logger.error(`gateway_v4 reaction handler error: ${err.message}`);
      }
    });

    // BUTTON handler (Slot C)
    client.on('interactionCreate', async (interaction) => {
      try {
        if (!interaction.isButton()) return;
        const customId = interaction.customId || '';
        if (!customId.startsWith('gateway_v4_button')) return;

        // format: gateway_v4_button:<guildId>
        const parts = customId.split(':');
        const guildId = parts[1] || (interaction.guild && interaction.guild.id);
        if (!guildId) return;

        const cfgObj = await getGuildConfig(guildId);
        const cfg = ensureConfig(cfgObj.modules?.gateway_v4 || {});
        if (!cfg.enabled) return;

        const slotC = cfg.slots.C;
        if (!slotC || !slotC.enabled) return;
        if (slotC.channelId && slotC.channelId !== interaction.channelId) return;

        // For buttons, we treat the button press as a verification trigger and respond ephemeral
        const user = interaction.user;
        const result = await processVerification({ guild: interaction.guild, user, channel: interaction.channel, system: slotC, chosenState: 'success' });

        // send ephemeral reply
        if (result.templateId) {
          const placeholders = {
            '{user}': user.username,
            '{mention}': `<@${user.id}>`,
            '{server}': interaction.guild?.name || '',
            '{memberCount}': String(interaction.guild?.memberCount || 0),
          };
          const emb = await embedEngine.renderEmbed(guildId, result.templateId, placeholders).catch(() => null);
          if (emb) await interaction.reply({ embeds: [emb], ephemeral: true }).catch(() => null);
          else await interaction.reply({ content: 'Verification processed.', ephemeral: true }).catch(() => null);
        } else {
          await interaction.reply({ content: 'Verification processed.', ephemeral: true }).catch(() => null);
        }
      } catch (err) {
        logger.error(`gateway_v4 button handler error: ${err.message}`);
      }
    });

    // ADMIN SelectMenu & Modal handlers for setup/bind
    client.on('interactionCreate', async (interaction) => {
      try {
        // Select Menu for admin actions
        if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
          const customId = interaction.customId || '';
          if (!customId.startsWith('gateway_v4_admin:')) return;
          const parts = customId.split(':');
          const guildId = parts[1] || interaction.guildId;
          const slot = parts[2] || null; // expected A/B/C/D
          const value = (interaction.values && interaction.values[0]) || null;
          if (!slot || !value) return interaction.reply({ content: 'Invalid admin selection.', ephemeral: true });

          // actions: bind_channel, bind_role, bind_templates, bind_attach_message, disable
          if (value === 'bind_channel') {
            const modal = new ModalBuilder().setCustomId(`gateway_v4_bind_modal:${guildId}:${slot}:channel`).setTitle('Bind Channel');
            const input = new TextInputBuilder().setCustomId('channel_id').setLabel('Channel ID').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
          }

          if (value === 'bind_role') {
            const modal = new ModalBuilder().setCustomId(`gateway_v4_bind_modal:${guildId}:${slot}:role`).setTitle('Bind Role');
            const input = new TextInputBuilder().setCustomId('role_id').setLabel('Role ID').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
          }

          if (value === 'bind_templates') {
            const modal = new ModalBuilder().setCustomId(`gateway_v4_bind_modal:${guildId}:${slot}:templates`).setTitle('Bind Templates');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('success_tpl').setLabel('Success Template ID').setStyle(TextInputStyle.Short).setRequired(false)));
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('fail_tpl').setLabel('Fail Template ID').setStyle(TextInputStyle.Short).setRequired(false)));
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('exists_tpl').setLabel('Exists Template ID').setStyle(TextInputStyle.Short).setRequired(false)));
            return interaction.showModal(modal);
          }

          if (value === 'bind_attach_message') {
            const modal = new ModalBuilder().setCustomId(`gateway_v4_bind_modal:${guildId}:${slot}:attach`).setTitle('Bind Attach Message');
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message_id').setLabel('Message ID to attach (for reactions)').setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
          }

          if (value === 'disable') {
            const cfgObj = await getGuildConfig(interaction.guildId);
            const cfg = ensureConfig(cfgObj.modules?.gateway_v4 || {});
            const s = slot.toUpperCase();
            cfg.slots[s].enabled = false;
            await saveConfig(interaction.guildId, cfg);
            return interaction.reply({ content: `Slot ${s} disabled.`, ephemeral: true });
          }
        }

        // Modal submits from admin binds
        if (interaction.isModalSubmit && interaction.isModalSubmit()) {
          const cid = interaction.customId || '';
          if (!cid.startsWith('gateway_v4_bind_modal:')) return;
          // format: gateway_v4_bind_modal:<guildId>:<slot>:<action>
          const parts = cid.split(':');
          const guildId = parts[1] || interaction.guildId;
          const slot = (parts[2] || '').toUpperCase();
          const action = parts[3] || '';
          const cfgObj = await getGuildConfig(guildId);
          const cfg = ensureConfig(cfgObj.modules?.gateway_v4 || {});

          if (!['A','B','C','D'].includes(slot)) return interaction.reply({ content: 'Invalid slot.', ephemeral: true });

          if (action === 'channel') {
            const channelId = interaction.fields.getTextInputValue('channel_id');
            cfg.slots[slot].channelId = channelId;
            cfg.slots[slot].enabled = true;
            await saveConfig(guildId, cfg);
            return interaction.reply({ content: `Slot ${slot} bound to channel ${channelId}.`, ephemeral: true });
          }

          if (action === 'role') {
            const roleId = interaction.fields.getTextInputValue('role_id');
            cfg.slots[slot].roleId = roleId;
            cfg.slots[slot].enabled = true;
            await saveConfig(guildId, cfg);
            return interaction.reply({ content: `Slot ${slot} will assign role ${roleId}.`, ephemeral: true });
          }

          if (action === 'templates') {
            const successTpl = interaction.fields.getTextInputValue('success_tpl');
            const failTpl = interaction.fields.getTextInputValue('fail_tpl');
            const existsTpl = interaction.fields.getTextInputValue('exists_tpl');
            if (successTpl) cfg.slots[slot].templates.success = successTpl;
            if (failTpl) cfg.slots[slot].templates.fail = failTpl;
            if (existsTpl) cfg.slots[slot].templates.exists = existsTpl;
            cfg.slots[slot].enabled = true;
            await saveConfig(guildId, cfg);
            return interaction.reply({ content: `Slot ${slot} templates updated.`, ephemeral: true });
          }

          if (action === 'attach') {
            const msgId = interaction.fields.getTextInputValue('message_id');
            cfg.slots[slot].attachMessageId = msgId;
            cfg.slots[slot].enabled = true;
            await saveConfig(guildId, cfg);
            return interaction.reply({ content: `Slot ${slot} attached to message ${msgId}.`, ephemeral: true });
          }
        }
      } catch (err) {
        logger.error(`gateway_v4 admin interaction error: ${err.message}`);
      }
    });
  },

  async handleSubcommand(interaction) {
    // minimal /gateway compatibility: enable/disable/view and basic slot setup
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const cfgObj = await getGuildConfig(guildId);
    const cfg = ensureConfig(cfgObj.modules?.gateway_v4 || {});

    switch (sub) {
      case 'enable': {
        const channel = interaction.options.getChannel('channel');
        cfg.enabled = true;
        if (channel) cfg.slots.B.channelId = channel.id;
        await saveConfig(guildId, cfg);
        await interaction.reply({ content: 'Gateway v4 enabled for this server.', ephemeral: true });
        break;
      }
      case 'disable': {
        cfg.enabled = false;
        await saveConfig(guildId, cfg);
        await interaction.reply({ content: 'Gateway v4 disabled for this server.', ephemeral: true });
        break;
      }
      case 'view': {
        await interaction.reply({ content: `Gateway v4 config: ${JSON.stringify(cfg, null, 2)}`, ephemeral: true });
        break;
      }
      case 'setup': {
        // open a simple select menu modal to choose slot and channel
        const slot = interaction.options.getString('slot');
        if (!slot || !['A','B','C','D'].includes(slot.toUpperCase())) return interaction.reply({ content: 'Invalid slot. Use A,B,C or D.', ephemeral: true });
        // Respond with instructions and a button to bind channel
        await interaction.reply({ content: `Setup for slot ${slot.toUpperCase()}: Reply with "/gateway bind" to bind channel, role, and templates.`, ephemeral: true });
        break;
      }
      case 'bind': {
        const slot = interaction.options.getString('slot');
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');
        const successTpl = interaction.options.getString('success_template');
        const failTpl = interaction.options.getString('fail_template');
        const existsTpl = interaction.options.getString('exists_template');
        if (!slot || !['A','B','C','D'].includes(slot.toUpperCase())) return interaction.reply({ content: 'Invalid slot. Use A,B,C or D.', ephemeral: true });
        const s = slot.toUpperCase();
        cfg.slots[s].enabled = true;
        if (channel) cfg.slots[s].channelId = channel.id;
        if (role) cfg.slots[s].roleId = role.id;
        if (successTpl) cfg.slots[s].templates.success = successTpl;
        if (failTpl) cfg.slots[s].templates.fail = failTpl;
        if (existsTpl) cfg.slots[s].templates.exists = existsTpl;
        await saveConfig(guildId, cfg);
        await interaction.reply({ content: `Slot ${s} bound: channel=${channel?.id||'none'} role=${role?.id||'none'} templates=${successTpl||'none'}/${failTpl||'none'}/${existsTpl||'none'}`, ephemeral: true });
        break;
      }
      default:
        await interaction.reply({ content: 'Unsupported subcommand for gateway v4.', ephemeral: true });
    }
  }
  ,
  async handleVerifyCommand(interaction) {
    try {
      const guild = interaction.guild;
      if (!guild) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });

      const guildId = guild.id;
      const cfgObj = await getGuildConfig(guildId);
      const cfg = ensureConfig(cfgObj.modules?.gateway_v4 || {});
      if (!cfg.enabled) return interaction.reply({ content: 'Gateway verification is not enabled.', ephemeral: true });

      const slotA = cfg.slots.A;
      if (!slotA || !slotA.enabled) return interaction.reply({ content: 'Slash verification is not available.', ephemeral: true });

      const result = await processVerification({ guild, user: interaction.user, channel: interaction.channel, system: slotA, chosenState: 'success' });

      if (result.templateId) {
        const placeholders = {
          '{user}': interaction.user.username,
          '{mention}': `<@${interaction.user.id}>`,
          '{server}': guild.name,
          '{memberCount}': String(guild.memberCount),
        };
        const emb = await embedEngine.renderEmbed(guildId, result.templateId, placeholders).catch(() => null);
        if (emb) await interaction.channel.send({ embeds: [emb] }).catch(() => null);
      }

      await interaction.reply({ content: '✅ Verification processed.', ephemeral: true }).catch(() => null);
    } catch (err) {
      logger.error(`/verify command error: ${err.message}`);
      try { await interaction.reply({ content: 'An error occurred during verification.', ephemeral: true }); } catch (e) {}
    }
  }
};
