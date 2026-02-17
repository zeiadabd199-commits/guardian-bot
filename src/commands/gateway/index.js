import { SlashCommandBuilder } from 'discord.js';
import gatewayModule from '../../modules/gateway/index.js';

export default {
    data: new SlashCommandBuilder()
        .setName('gateway')
        .setDescription('Manage gateway verification system')
        .setDefaultMemberPermissions('0')
        .addSubcommand(sub =>
            sub
                .setName('enable')
                .setDescription('Enable the gateway verification system')
                .addChannelOption(opt =>
                    opt
                        .setName('channel')
                        .setDescription('Channel for verification messages')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('disable')
                .setDescription('Disable the gateway verification system')
        )
        .addSubcommand(sub =>
            sub
                .setName('view')
                .setDescription('View current gateway configuration')
        )
        .addSubcommand(sub =>
            sub
                .setName('stats')
                .setDescription('View gateway verification statistics')
        )
        // /gateway mode set
        .addSubcommandGroup(group =>
            group
                .setName('mode')
                .setDescription('Set verification mode')
                .addSubcommand(sub =>
                    sub
                        .setName('set')
                        .setDescription('Set the verification mode')
                        .addStringOption(opt =>
                            opt
                                .setName('mode')
                                .setDescription('Verification mode')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Trigger Word', value: 'trigger' },
                                    { name: 'Button Click', value: 'button' },
                                    { name: 'Reaction', value: 'reaction' },
                                    { name: 'Slash Command', value: 'slash' }
                                )
                        )
                )
        )
        // /gateway security set
        .addSubcommandGroup(group =>
            group
                .setName('security')
                .setDescription('Configure security settings')
                .addSubcommand(sub =>
                    sub
                        .setName('set')
                        .setDescription('Set a security parameter')
                        .addStringOption(opt =>
                            opt
                                .setName('field')
                                .setDescription('Security field to update')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Min Account Age (days)', value: 'minAccountAgeDays' },
                                    { name: 'Min Join Age (minutes)', value: 'minJoinMinutes' },
                                    { name: 'Rate Limit (per minute)', value: 'rateLimitPerMinute' },
                                    { name: 'Raid Threshold (per minute)', value: 'raidThresholdPerMinute' },
                                    { name: 'Lock Duration (minutes)', value: 'lockDurationMinutes' }
                                )
                        )
                        .addNumberOption(opt =>
                            opt
                                .setName('value')
                                .setDescription('The value to set')
                                .setRequired(true)
                        )
                )
        )
        // /gateway role ...
        .addSubcommandGroup(group =>
            group
                .setName('role')
                .setDescription('Configure verification roles')
                .addSubcommand(sub =>
                    sub
                        .setName('set_verify')
                        .setDescription('Set the verified role')
                        .addRoleOption(opt =>
                            opt
                                .setName('role')
                                .setDescription('Role to grant upon verification')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('bypass_add')
                        .setDescription('Add a role that bypasses verification')
                        .addRoleOption(opt =>
                            opt
                                .setName('role')
                                .setDescription('Role to add')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('bypass_remove')
                        .setDescription('Remove a bypass role')
                        .addRoleOption(opt =>
                            opt
                                .setName('role')
                                .setDescription('Role to remove')
                                .setRequired(true)
                        )
                )
        )
        // /gateway logs ...
        .addSubcommandGroup(group =>
            group
                .setName('logs')
                .setDescription('Configure gateway logging')
                .addSubcommand(sub =>
                    sub
                        .setName('enable')
                        .setDescription('Enable gateway verification logs')
                        .addChannelOption(opt =>
                            opt
                                .setName('channel')
                                .setDescription('Channel to send logs to')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('disable')
                        .setDescription('Disable gateway verification logs')
                )
        )
        // /gateway message set
        .addSubcommandGroup(group =>
            group
                .setName('message')
                .setDescription('Configure messages')
                .addSubcommand(sub =>
                    sub
                        .setName('set')
                        .setDescription('Set the verification message')
                        .addStringOption(opt =>
                            opt
                                .setName('text')
                                .setDescription('Message text (use {mention}, {user}, {server})')
                                .setRequired(true)
                        )
                )
        )
        // /gateway embed ...
        .addSubcommandGroup(group =>
            group
                .setName('embed')
                .setDescription('Configure embed messages')
                .addSubcommand(sub =>
                    sub
                        .setName('edit')
                        .setDescription('Edit an embed field')
                        .addStringOption(opt =>
                            opt
                                .setName('type')
                                .setDescription('Embed type (public or DM)')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Public (Channel)', value: 'public' },
                                    { name: 'Private (DM)', value: 'dm' }
                                )
                        )
                        .addStringOption(opt =>
                            opt
                                .setName('field')
                                .setDescription('Field to edit')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Title', value: 'title' },
                                    { name: 'Description', value: 'description' },
                                    { name: 'Color', value: 'color' },
                                    { name: 'Thumbnail URL', value: 'thumbnailUrl' },
                                    { name: 'Image URL', value: 'imageUrl' },
                                    { name: 'Footer Text', value: 'footerText' }
                                )
                        )
                        .addStringOption(opt =>
                            opt
                                .setName('value')
                                .setDescription('New value')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('preview')
                        .setDescription('Preview an embed')
                        .addStringOption(opt =>
                            opt
                                .setName('type')
                                .setDescription('Embed type to preview')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Public (Channel)', value: 'public' },
                                    { name: 'Private (DM)', value: 'dm' }
                                )
                        )
                )
        )
        // /gateway lock/unlock
        .addSubcommandGroup(group =>
            group
                .setName('lock')
                .setDescription('Gateway lock management')
                .addSubcommand(sub =>
                    sub
                        .setName('lock')
                        .setDescription('Manually lock the gateway')
                        .addNumberOption(opt =>
                            opt
                                .setName('minutes')
                                .setDescription('Lock duration in minutes')
                                .setRequired(false)
                        )
                        .addStringOption(opt =>
                            opt
                                .setName('reason')
                                .setDescription('Reason for lock')
                                .setRequired(false)
                        )
                )
                .addSubcommand(sub =>
                    sub
                        .setName('unlock')
                        .setDescription('Manually unlock the gateway')
                )
        ),

    async execute(interaction) {
        await gatewayModule.handleSubcommand(interaction);
    }
};
