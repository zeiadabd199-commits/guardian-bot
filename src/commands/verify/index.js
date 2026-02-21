import { SlashCommandBuilder } from 'discord.js';
import { performVerify } from '../../core/gatewayLogic.js';
import { getGuildConfig } from '../../core/database.js';
export default {
        data: new SlashCommandBuilder().setName('verify').setDescription('Verify your account to access the server'),
            async execute(interaction) {
                        await interaction.deferReply({ ephemeral: true });
                                const config = await getGuildConfig(interaction.guildId);
                                        if (config?.gateway?.type !== 'SLASH') return interaction.editReply({ content: 'Slash verification is disabled on this server.' });
                                                const result = await performVerify(interaction.guild, interaction.user, interaction.client, 'SLASH');
                                                        if (!result.ok) return interaction.editReply({ content: 'Verification failed. Please contact an admin.' });
                                                                await interaction.editReply({ content: result.already ? 'You are already verified.' : 'Verification successful! Welcome!' });
            }
};
