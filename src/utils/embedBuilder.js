import { EmbedBuilder } from 'discord.js';

export const createEmbed = (data) => {
    return new EmbedBuilder()
        .setColor(data.color || 0x0099FF)
        .setTitle(data.title || 'Guardian')
        .setDescription(data.description || 'System message')
        .setTimestamp();
};
