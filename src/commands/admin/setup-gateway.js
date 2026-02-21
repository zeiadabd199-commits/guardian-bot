import { SlashCommandBuilder } from 'discord.js';
import gatewayManager from '../../modules/gateway/gatewayManager.js';
import { updateGuildConfig, getGuildConfig } from '../../core/database.js';
import { logger } from '../../core/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setup-gateway')
        .setDescription('Configure and deploy the gateway message for the server')
        .setDefaultMemberPermissions('8')
        .addSubcommand(sc => sc.setName('button').setDescription('Deploy a button-based gateway')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant on verification').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to send the gateway message').setRequired(true))
            .addStringOption(o => o.setName('embed_text').setDescription('Embed text/description').setRequired(false))
            .addStringOption(o => o.setName('button_label').setDescription('Label for the button').setRequired(false))
            .addStringOption(o => o.setName('button_style').setDescription('Button style (Primary/Secondary/Success/Danger)').setRequired(false)))

        .addSubcommand(sc => sc.setName('reaction').setDescription('Deploy a reaction-based gateway')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant on verification').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to send the gateway message').setRequired(true))
            .addStringOption(o => o.setName('embed_text').setDescription('Embed text/description').setRequired(false))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji to react with (unicode or <:name:id>)').setRequired(false)))

        .addSubcommand(sc => sc.setName('trigger').setDescription('Deploy a trigger-word gateway')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant on verification').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to send the gateway message').setRequired(true))
            .addStringOption(o => o.setName('trigger_word').setDescription('Trigger word users must type').setRequired(true))
            .addStringOption(o => o.setName('instruction_text').setDescription('Instruction text to show in the embed').setRequired(false)))

        .addSubcommand(sc => sc.setName('slash').setDescription('Deploy an instruction to use the /verify command')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant on verification').setRequired(true))
            .addChannelOption(o => o.setName('channel').setDescription('Channel to send the gateway message').setRequired(true))
            .addStringOption(o => o.setName('instruction_text').setDescription('Instruction text to show in the embed').setRequired(false))),

    async execute(interaction) {
        if (!interaction.inGuild() || !interaction.guild) return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        try {
            const sub = interaction.options.getSubcommand();
            const guildId = interaction.guildId;

            const role = interaction.options.getRole('role');
            const channel = interaction.options.getChannel('channel');

            if (!channel || !channel.send) return interaction.editReply({ content: 'Please provide a valid text channel.', ephemeral: true });

            let settings = {};
            let typeKey = '';

            if (sub === 'button') {
                typeKey = 'BUTTON';
                settings = {
                    roleId: role?.id || null,
                    channelId: channel.id,
                    embedText: interaction.options.getString('embed_text') || null,
                    buttonLabel: interaction.options.getString('button_label') || 'Verify',
                    buttonStyle: interaction.options.getString('button_style') || 'Primary'
                };
            } else if (sub === 'reaction') {
                typeKey = 'REACTION';
                settings = {
                    roleId: role?.id || null,
                    channelId: channel.id,
                    embedText: interaction.options.getString('embed_text') || null,
                    emoji: interaction.options.getString('emoji') || '✅'
                };
            } else if (sub === 'trigger') {
                typeKey = 'TRIGGER';
                settings = {
                    roleId: role?.id || null,
                    channelId: channel.id,
                    triggerWord: interaction.options.getString('trigger_word') || 'verify',
                    instructionText: interaction.options.getString('instruction_text') || null
                };
            } else if (sub === 'slash') {
                typeKey = 'SLASH';
                settings = {
                    roleId: role?.id || null,
                    channelId: channel.id,
                    instructionText: interaction.options.getString('instruction_text') || null
                };
            } else {
                return interaction.editReply({ content: 'Unknown subcommand.', ephemeral: true });
            }

            // Persist configuration
            const updateData = {
                'gateway.type': typeKey,
                'gateway.enabled': true,
                [`gateway.settings.${typeKey}`]: settings
            };

            if (role?.id) updateData['gateway.verifiedRoleId'] = role.id;

            const saved = await updateGuildConfig(guildId, updateData);
            if (!saved) return interaction.editReply({ content: 'Failed to save gateway configuration.', ephemeral: true });

            // Deploy the gateway message
            await gatewayManager.sendGatewayMessage(interaction.guild, channel, typeKey, settings);

            return interaction.editReply({ content: `Gateway deployed as ${typeKey} in ${channel}.`, ephemeral: true });

        } catch (error) {
            logger.error(`admin/setup-gateway failed: ${error.message}`);
            try { await interaction.editReply({ content: 'An error occurred while deploying the gateway. Check logs.', ephemeral: true }); } catch (e) { /* ignore */ }
        }
    }
};
