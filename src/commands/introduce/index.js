import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('introduce')
        .setDescription('Introduce yourself to the server'),
    async execute(interaction) {
        await interaction.reply({ content: 'Welcome!', ephemeral: true });
    }
};
