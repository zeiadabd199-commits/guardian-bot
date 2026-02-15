import { PermissionFlagsBits } from 'discord.js';

export async function checkAdminPermission(interaction) {
    if (!interaction.member) return false;
    
    const isAdmin = interaction.member.permissions?.has(PermissionFlagsBits.Administrator);
    return isAdmin || false;
}
