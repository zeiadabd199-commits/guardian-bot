export const moduleSchema = {
    enabled: {
        type: 'boolean',
        default: false,
        description: 'Enable/disable the introduce module',
    },
    channelId: {
        type: 'string',
        default: null,
        description: 'Channel ID where introduction message is sent',
    },
    message: {
        type: 'object',
        default: {
            type: 'text',
            content: 'Welcome to the server!',
            emoji: '👋',
        },
        description: 'Message configuration',
        nested: {
            type: {
                type: 'string',
                enum: ['text', 'embed'],
                default: 'text',
                description: 'Message type: text or embed',
            },
            content: {
                type: 'string',
                default: 'Welcome to the server!',
                description: 'Message content',
            },
            emoji: {
                type: 'string',
                default: '👋',
                nullable: true,
                description: 'Emoji to use in message',
            },
        },
    },
    embed: {
        type: 'object',
        default: {
            enabled: true,
            title: 'Welcome',
            description: 'Welcome to our server!',
            color: '#0099FF',
            image: null,
            thumbnail: null,
        },
        description: 'Embed display configuration',
        nested: {
            enabled: {
                type: 'boolean',
                default: true,
                description: 'Enable embed display',
            },
            title: {
                type: 'string',
                default: 'Welcome',
                description: 'Embed title',
            },
            description: {
                type: 'string',
                default: 'Welcome to our server!',
                description: 'Embed description',
            },
            color: {
                type: 'string',
                default: '#0099FF',
                description: 'Embed color in hex format',
            },
            image: {
                type: 'string',
                default: null,
                nullable: true,
                description: 'Embed image URL',
            },
            thumbnail: {
                type: 'string',
                default: null,
                nullable: true,
                description: 'Embed thumbnail URL',
            },
        },
    },
};

/**
 * Ensure config has the proper structure with all required fields
 * Migrate old fields to new structure if they exist
 */
export function ensureDefaultConfig(existingConfig = {}) {
    const defaults = {
        enabled: existingConfig.enabled ?? moduleSchema.enabled.default,
        channelId: existingConfig.channelId ?? moduleSchema.channelId.default,
        message: {
            type: existingConfig.message?.type ?? existingConfig.message ?? moduleSchema.message.default.type,
            content: existingConfig.message?.content ?? moduleSchema.message.default.content,
            emoji: existingConfig.message?.emoji ?? existingConfig.emoji ?? moduleSchema.message.default.emoji,
        },
        embed: {
            enabled: existingConfig.embed?.enabled ?? existingConfig.embedEnabled ?? moduleSchema.embed.default.enabled,
            title: existingConfig.embed?.title ?? moduleSchema.embed.default.title,
            description: existingConfig.embed?.description ?? moduleSchema.embed.default.description,
            color: existingConfig.embed?.color ?? moduleSchema.embed.default.color,
            image: existingConfig.embed?.image ?? moduleSchema.embed.default.image,
            thumbnail: existingConfig.embed?.thumbnail ?? moduleSchema.embed.default.thumbnail,
        },
    };
    return defaults;
}
