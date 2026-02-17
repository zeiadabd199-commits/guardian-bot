import { SlashCommandBuilder } from 'discord.js';
import introduceModule from '../../modules/introduce/index.js';

export default {
    data: new SlashCommandBuilder()
        .setName('gateway')
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
        .addSubcommand(sub =>
            sub
                .setName('stats')
                .setDescription('View gateway statistics')
        )
        .addSubcommandGroup(group =>
            group
                .setName('message')
                .setDescription('Manage introduction message')
                .addSubcommand(sub =>
                    sub
                        .setName('set')
                        .setDescription('Set custom introduction message (legacy)')
                        .addStringOption(opt =>
                            opt
                                .setName('text')
                                .setDescription('The message text to display')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('success')
                        .setDescription('Set success message')
                        .addStringOption(opt => opt.setName('text').setDescription('Success text').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName('error')
                        .setDescription('Set error message')
                        .addStringOption(opt => opt.setName('text').setDescription('Error text').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName('already')
                        .setDescription('Set already-verified message')
                        .addStringOption(opt => opt.setName('text').setDescription('Already text').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName('dm')
                        .setDescription('Set DM instruction message')
                        .addStringOption(opt => opt.setName('text').setDescription('DM text').setRequired(true))
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
        )
        .addSubcommandGroup(group =>
            group
                .setName('trigger')
                .setDescription('Manage trigger word')
                .addSubcommand(sub =>
                    sub
                        .setName('set')
                        .setDescription('Set the trigger word')
                        .addStringOption(opt => opt.setName('word').setDescription('Trigger word').setRequired(true))
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('role')
                .setDescription('Set verification-related roles')
                .addSubcommand(sub =>
                    sub
                        .setName('set_verify')
                        .setDescription('Set verify role')
                        .addRoleOption(opt => opt.setName('verify_role').setDescription('Role to grant on verify').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName('set_pending')
                        .setDescription('Set pending role')
                        .addRoleOption(opt => opt.setName('pending_role').setDescription('Role to add on join').setRequired(true))
                )
                .addSubcommand(sub =>
                    sub
                        .setName('set_remove')
                        .setDescription('Set optional remove role')
                        .addRoleOption(opt => opt.setName('remove_role').setDescription('Role to remove on verify').setRequired(true))
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('channel')
                .setDescription('Set verification channel')
                .addSubcommand(sub =>
                    sub
                        .setName('set')
                        .setDescription('Set verify channel')
                        .addChannelOption(opt => opt.setName('verify_channel').setDescription('Channel where users must type the trigger word').setRequired(true))
                )
        ),
    async execute(interaction) {
        await introduceModule.handleSubcommand(interaction);
    }
};
