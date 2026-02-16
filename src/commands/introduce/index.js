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
        )
        .addSubcommandGroup(group =>
            group
                .setName('message')
                .setDescription('Manage introduction message')
                .addSubcommand(sub =>
                    sub
                        .setName('set')
                        .setDescription('Set custom introduction message')
                        .addStringOption(opt =>
                            opt
                                .setName('text')
                                .setDescription('The message text to display')
                                .setRequired(true)
                        )
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('emoji')
                .setDescription('Manage introduction emoji')
                .addSubcommand(sub =>
                    sub
                        .setName('set')
                        .setDescription('Set emoji for introduction message')
                        .addStringOption(opt =>
                            opt
                                .setName('emoji')
                                .setDescription('The emoji to use')
                                .setRequired(true)
                        )
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('embed')
                .setDescription('Manage embed display settings')
                .addSubcommand(sub =>
                    sub
                        .setName('toggle')
                        .setDescription('Toggle embed display for introduction message')
                        .addBooleanOption(opt =>
                            opt
                                .setName('enabled')
                                .setDescription('Enable or disable embed display')
                                .setRequired(true)
                        )
                )
        ),
    async execute(interaction) {
        await introduceModule.handleSubcommand(interaction);
    }
};
