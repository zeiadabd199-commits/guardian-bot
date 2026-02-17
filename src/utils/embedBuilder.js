import { EmbedBuilder } from 'discord.js';

/**
 * Create a simple embed (legacy support)
 */
export const createEmbed = (data) => {
    return new EmbedBuilder()
        .setColor(data.color || 0x0099FF)
        .setTitle(data.title || 'Guardian')
        .setDescription(data.description || 'System message')
        .setTimestamp();
};

/**
 * CENTRALIZED EMBED BUILDER
 * Used by Gateway, Welcome Messages, Logs, and Future Modules
 * Supports template replacement and customizable styling
 */
export class GatewayEmbedBuilder {
    constructor(config = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            title: config.title || 'Gateway',
            description: config.description || 'Welcome to our server!',
            color: this.parseColor(config.color || '#0099FF'),
            thumbnailUrl: config.thumbnailUrl || null,
            imageUrl: config.imageUrl || null,
            footerText: config.footerText || null,
        };
    }

    /**
     * Parse color from hex string to Discord.js color format
     */
    parseColor(colorString) {
        if (!colorString) return 0x0099FF;
        
        // Already a number
        if (typeof colorString === 'number') return colorString;
        
        // Hex string
        const hex = String(colorString).replace('#', '');
        const valid = /^[0-9A-Fa-f]{6}$/.test(hex);
        return valid ? parseInt(hex, 16) : 0x0099FF;
    }

    /**
     * Apply template replacements to text
     */
    applyTemplates(text, templates = {}) {
        if (!text) return '';
        let result = String(text);
        Object.entries(templates).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                result = result.split(key).join(String(value));
            }
        });
        return result;
    }

    /**
     * Build the embed with optional template replacement
     */
    build(templates = {}) {
        const embed = new EmbedBuilder()
            .setColor(this.config.color)
            .setTitle(this.applyTemplates(this.config.title, templates))
            .setDescription(this.applyTemplates(this.config.description, templates));

        if (this.config.thumbnailUrl) {
            embed.setThumbnail(this.config.thumbnailUrl);
        }

        if (this.config.imageUrl) {
            embed.setImage(this.config.imageUrl);
        }

        if (this.config.footerText) {
            embed.setFooter({ text: this.applyTemplates(this.config.footerText, templates) });
        } else {
            embed.setFooter({ text: 'Guardian Gateway' });
        }

        embed.setTimestamp();

        return embed;
    }

    /**
     * Add custom fields to the embed
     */
    buildWithFields(fields = [], templates = {}) {
        const embed = this.build(templates);
        
        fields.forEach(field => {
            embed.addFields({
                name: this.applyTemplates(field.name, templates),
                value: this.applyTemplates(field.value, templates),
                inline: field.inline ?? false,
            });
        });

        return embed;
    }
}

/**
 * Create a gateway verification embed
 */
export function createGatewayEmbed(config, message = '', templates = {}) {
    const builder = new GatewayEmbedBuilder(config);
    
    // Override description with message if provided
    if (message) {
        builder.config.description = builder.applyTemplates(message, templates);
    }
    
    return builder.build(templates);
}

/**
 * Create a welcome embed for new members
 */
export function createWelcomeEmbed(config, templates = {}) {
    const builder = new GatewayEmbedBuilder({
        title: config.embedTitle || 'Welcome!',
        description: config.embedDescription || 'Thanks for joining!',
        color: config.embedColor || '#00FF00',
        thumbnailUrl: config.thumbnailUrl || null,
        imageUrl: config.imageUrl || null,
        footerText: config.footerText || null,
    });

    return builder.build(templates);
}

/**
 * Create a log/audit embed for gateway attempts
 */
export function createGatewayLogEmbed(status, user, data = {}) {
    const statusColors = {
        'success': 0x00FF00,
        'blocked_account_age': 0xFF6600,
        'blocked_join_age': 0xFF6600,
        'blocked_spam': 0xFF6600,
        'gateway_locked': 0xFF0000,
        'already': 0xFFFF00,
        'error': 0xFF0000,
    };

    const embed = new EmbedBuilder()
        .setColor(statusColors[status] || 0x999999)
        .setTitle(`Gateway Attempt - ${status}`)
        .addFields(
            { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Account Age', value: data.accountAge || 'N/A', inline: true },
            { name: 'Join Age', value: data.joinAge || 'N/A', inline: true },
            { name: 'Mode', value: data.mode || 'unknown', inline: true },
            { name: 'Result', value: String(status), inline: true },
        )
        .setFooter({ text: 'Gateway Verification Log' })
        .setTimestamp();

    return embed;
}
