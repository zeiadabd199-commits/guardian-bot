import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getGuildConfig } from '../../core/database.js';
import { createGatewayEmbed } from '../../utils/embedBuilder.js';
import { logger } from '../../core/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setup-gateway')
        .setDescription('Send the configured gateway message into this channel')
        .setDefaultMemberPermissions('8'), // Admins only

    async execute(interaction) {
        if (!interaction.inGuild() || !interaction.guild) {
            return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const guildId = interaction.guildId;
            const guildConfig = await getGuildConfig(guildId);
            if (!guildConfig) return interaction.editReply({ content: 'Unable to load guild configuration.', ephemeral: true });

            const gateway = guildConfig.gateway || {};

            const embed = createGatewayEmbed(gateway, gateway.setupMessage || gateway.description || 'Please verify to access the server.');

            // Different behaviors depending on gateway type
            if (gateway.type === 'BUTTON') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('gateway_verify_btn').setLabel('Verify').setStyle(ButtonStyle.Primary)
                );

                await interaction.channel.send({ embeds: [embed], components: [row] });
                await interaction.editReply({ content: 'Sent the verification button message.', ephemeral: true });
                return;
            }

            if (gateway.type === 'REACTION') {
                const msg = await interaction.channel.send({ embeds: [embed] });
                try { await msg.react('✅'); } catch (err) { logger.warn(`Failed to react with verify emoji: ${err.message}`); }
                await interaction.editReply({ content: 'Sent the verification message and reacted with ✅.', ephemeral: true });
                return;
            }

            if (gateway.type === 'SLASH') {
                // Instruct users to run the /verify command
                const instructionEmbed = createGatewayEmbed(gateway, gateway.slashInstruction || 'Please use the /verify command to verify yourself.');
                await interaction.channel.send({ embeds: [instructionEmbed] });
                await interaction.editReply({ content: 'Sent the slash verification instructions.', ephemeral: true });
                return;
            }

            if (gateway.type === 'TRIGGER') {
                const triggerWord = gateway.triggerWord || gateway.keyword || 'verify';
                const instruction = gateway.triggerInstruction || `Type the trigger word **${triggerWord}** in chat to verify.`;
                const instructionEmbed = createGatewayEmbed(gateway, instruction);
                await interaction.channel.send({ embeds: [instructionEmbed] });
                await interaction.editReply({ content: "Sent the trigger-word instructions.", ephemeral: true });
                return;
            }

            // Default fallback
            await interaction.channel.send({ embeds: [embed] });
            await interaction.editReply({ content: 'Sent a gateway message (fallback).', ephemeral: true });

        } catch (error) {
            logger.error(`setup-gateway failed: ${error.message}`);
            try { await interaction.editReply({ content: 'Failed to send gateway message. Check logs.', ephemeral: true }); } catch (e) { /* ignore */ }
        }
    }
};
