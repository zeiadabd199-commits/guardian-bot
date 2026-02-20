import { SlashCommandBuilder } from 'discord.js';
import gatewayModule from '../../modules/gateway_v4/index.js';

export default {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify yourself to gain access to the server'),

    async execute(interaction) {
        await gatewayModule.handleVerifyCommand(interaction);
    }
};
