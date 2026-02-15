import { SlashCommandBuilder } from 'discord.js';
import introduceModule from '../../modules/introduce/index.js';

export default {
    data: new SlashCommandBuilder()
        .setName('introduce')
        .setDescription('Manage the introduce module')
        .addSubcommand(sub =>
            sub
                .setName('enable')
                .setDescription('Enable the introduce module')
                .addChannelOption(opt =>
                    opt
                        .setName('channel')
                        .setDescription('Channel for introduction messages')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('disable')
                .setDescription('Disable the introduce module')
        )
        .addSubcommand(sub =>
            sub
                .setName('view')
                .setDescription('View introduce module configuration')
        ),
    async execute(interaction) {
        await introduceModule.handleSubcommand(interaction);
    }
};
