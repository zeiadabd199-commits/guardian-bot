import { Events, InteractionType } from 'discord.js';
import { getGuildConfig, getUserConfig, updateUserConfig } from '../core/database.js';
import { createGatewayEmbed, createGatewayLogEmbed } from '../utils/embedBuilder.js';
import { logger } from '../core/logger.js';

export default {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        // Central verification routine used by different entry points
        async function performVerify(guild, user, source = {}) {
            try {
                const guildConfig = await getGuildConfig(guild.id);
                if (!guildConfig) return { ok: false, reason: 'no_guild_config' };

                const verifiedRoleId = guildConfig.gateway?.verifiedRoleId;
                if (!verifiedRoleId) return { ok: false, reason: 'no_verified_role' };

                // Fetch member instance
                const member = await guild.members.fetch(user.id).catch(() => null);
                if (!member) return { ok: false, reason: 'member_not_found' };

                // If already has role, treat as already verified
                const already = member.roles.cache.has(verifiedRoleId);

                if (!already) {
                    try {
                        await member.roles.add(verifiedRoleId, 'Gateway verification');
                    } catch (err) {
                        logger.warn(`Failed to add verified role: ${err.message}`);
                        return { ok: false, reason: 'role_add_failed', error: err };
                    }
                }

                // Update user config in DB
                await updateUserConfig(user.id, guild.id, { 'gateway.isVerified': true, 'gateway.verifiedAt': new Date() });

                // Send DM with server rules (best-effort)
                const dmMessage = guildConfig.gateway?.dmMessage || `You are now verified in ${guild.name}. Please follow the server rules.`;
                try {
                    await user.send({ embeds: [createGatewayEmbed(guildConfig.gateway || {}, dmMessage)] });
                } catch (err) {
                    // DMs are closed or blocked; ignore but continue
                    logger.info(`Could not DM user ${user.id} (${err.message}). Continuing verification.`);
                }

                // Optionally log the verification attempt to a log channel
                try {
                    const logChannelId = guildConfig.gateway?.logChannelId;
                    if (logChannelId) {
                        const ch = await client.channels.fetch(logChannelId).catch(() => null);
                        if (ch && ch.isTextBased && ch.send) {
                            const logEmbed = createGatewayLogEmbed('success', user, { mode: source.mode || 'unknown' });
                            await ch.send({ embeds: [logEmbed] }).catch(() => null);
                        }
                    }
                } catch (err) {
                    logger.warn(`Failed to send gateway log: ${err.message}`);
                }

                return { ok: true, already };
            } catch (error) {
                logger.error(`performVerify error: ${error.message}`);
                return { ok: false, reason: 'exception', error };
            }
        }

        // InteractionCreate: handle button clicks and /verify command
        client.on(Events.InteractionCreate, async (interaction) => {
            try {
                // Button verify
                if (interaction.type === InteractionType.MessageComponent) {
                    if (interaction.customId === 'gateway_verify_btn') {
                        await interaction.deferReply({ ephemeral: true });
                        const result = await performVerify(interaction.guild, interaction.user, { mode: 'BUTTON' });
                        if (!result.ok) {
                            await interaction.editReply({ content: 'Failed to verify. Please contact an administrator.', ephemeral: true });
                            return;
                        }
                        await interaction.editReply({ content: 'You are now verified. Welcome!', ephemeral: true });
                        return;
                    }
                    return;
                }

                // Slash command verify
                if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
                    if (interaction.commandName === 'verify') {
                        await interaction.deferReply({ ephemeral: true });
                        const result = await performVerify(interaction.guild, interaction.user, { mode: 'SLASH' });
                        if (!result.ok) {
                            await interaction.editReply({ content: 'Verification failed. Ask an admin to check the gateway configuration.', ephemeral: true });
                            return;
                        }
                        await interaction.editReply({ content: 'You have been verified successfully.', ephemeral: true });
                    }
                }
            } catch (err) {
                logger.error(`Interaction handler error: ${err.message}`);
            }
        });

        // MessageReactionAdd: handle ✅ reactions for REACTION mode
        client.on(Events.MessageReactionAdd, async (reaction, user) => {
            try {
                if (user.bot) return;
                // If partial, fetch
                if (reaction.partial) {
                    try { await reaction.fetch(); } catch (e) { return; }
                }

                const msg = reaction.message;
                if (!msg || !msg.guild) return;

                // Only handle green checkmark
                if (reaction.emoji.name !== '✅') return;

                // Ensure the guild's gateway type is REACTION and message is in correct channel (if configured)
                const guildConfig = await getGuildConfig(msg.guild.id);
                if (!guildConfig) return;
                if ((guildConfig.gateway?.type || 'BUTTON') !== 'REACTION') return;

                const result = await performVerify(msg.guild, user, { mode: 'REACTION' });
                if (!result.ok) {
                    // can't reply ephemerally; optionally notify via DM
                    try { await user.send('Verification failed. Please contact an administrator.'); } catch (e) { /* ignore */ }
                    return;
                }

                try {
                    const reply = await msg.channel.send(`${user} has been verified.`).catch(() => null);
                    if (reply) setTimeout(() => reply.delete().catch(() => null), 5000);
                } catch (e) { /* ignore */ }

            } catch (err) {
                logger.error(`Reaction handler error: ${err.message}`);
            }
        });

        // MessageCreate: handle trigger words
        client.on(Events.MessageCreate, async (message) => {
            try {
                if (message.author.bot) return;
                if (!message.guild) return;

                const guildConfig = await getGuildConfig(message.guild.id);
                if (!guildConfig) return;
                if ((guildConfig.gateway?.type || '') !== 'TRIGGER') return;

                const triggerWord = (guildConfig.gateway?.triggerWord || 'verify').toString().trim().toLowerCase();
                const content = (message.content || '').trim().toLowerCase();
                if (!content) return;

                if (content === triggerWord) {
                    // Delete trigger message (best-effort)
                    try { await message.delete().catch(() => null); } catch (e) { /* ignore */ }

                    const result = await performVerify(message.guild, message.author, { mode: 'TRIGGER' });
                    if (!result.ok) {
                        try { await message.author.send('Verification failed. Please contact an administrator.'); } catch (e) { /* ignore */ }
                        return;
                    }

                    // Send a short confirmation visible in channel, then delete it
                    try {
                        const reply = await message.channel.send(`${message.author}, you have been verified.`).catch(() => null);
                        if (reply) setTimeout(() => reply.delete().catch(() => null), 5000);
                    } catch (e) { /* ignore */ }
                }

            } catch (err) {
                logger.error(`Trigger handler error: ${err.message}`);
            }
        });

        logger.info('GatewayHandler: registered interaction, reaction and message listeners.');
    }
};
