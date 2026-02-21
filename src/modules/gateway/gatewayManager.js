import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createGatewayEmbed } from '../../utils/embedBuilder.js';
import { logger } from '../../core/logger.js';

function mapButtonStyle(style) {
    if (!style) return ButtonStyle.Primary;
    const s = String(style).toLowerCase();
    if (s === 'secondary') return ButtonStyle.Secondary;
    if (s === 'success') return ButtonStyle.Success;
    if (s === 'danger') return ButtonStyle.Danger;
    return ButtonStyle.Primary;
}

const gatewayManager = {
    renderEmbed(settings = {}, overrideText = '') {
        const text = overrideText || settings.embedText || settings.instructionText || settings.triggerInstruction || settings.description || '';
        return createGatewayEmbed(settings, text);
    },

    async sendGatewayMessage(guild, channel, type, settings = {}) {
        try {
            if (!channel || !channel.send) throw new Error('Invalid channel provided');

            // Normalize type
            const T = String(type || '').toUpperCase();

            if (T === 'BUTTON') {
                const embed = this.renderEmbed(settings, settings.embedText);
                const label = settings.buttonLabel || 'Verify';
                const style = mapButtonStyle(settings.buttonStyle);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('gateway_verify_btn').setLabel(label).setStyle(style)
                );
                return await channel.send({ embeds: [embed], components: [row] });
            }

            if (T === 'REACTION') {
                const embed = this.renderEmbed(settings, settings.embedText);
                const msg = await channel.send({ embeds: [embed] });
                const emoji = settings.emoji || '✅';
                try { await msg.react(emoji); } catch (err) { logger.warn(`Gateway reaction failed: ${err.message}`); }
                return msg;
            }

            if (T === 'SLASH') {
                const embed = this.renderEmbed(settings, settings.instructionText || settings.embedText || 'Please use the /verify command to verify.');
                return await channel.send({ embeds: [embed] });
            }

            if (T === 'TRIGGER') {
                const trigger = settings.triggerWord || settings.trigger || 'verify';
                const instruction = settings.instructionText || `Type the trigger word **${trigger}** in chat to verify.`;
                const embed = this.renderEmbed(settings, instruction);
                return await channel.send({ embeds: [embed] });
            }

            // Fallback
            const embed = this.renderEmbed(settings, settings.embedText || 'Please verify to access the server.');
            return await channel.send({ embeds: [embed] });
        } catch (error) {
            logger.error(`gatewayManager.sendGatewayMessage: ${error.message}`);
            throw error;
        }
    }
};

export default gatewayManager;
