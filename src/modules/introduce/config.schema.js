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
            emoji: {
                success: '👋',
                already: '⚠️',
                error: '❌',
            },
            delivery: 'channel',
            emojiMode: 'inline',
            },
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
                type: 'object',
                default: {
                    success: '👋',
                    already: '⚠️',
                    error: '❌',
                },
                nullable: true,
                description: 'Emojis for different states',
                nested: {
                    success: {
                        type: 'string',
                        default: '👋',
                        nullable: true,
                        description: 'Emoji for successful introduction',
                    },
                    already: {
                        type: 'string',
                        default: '⚠️',
                        nullable: true,
                        description: 'Emoji for already introduced',
                    },
                    error: {
                        type: 'string',
                        default: '❌',
                        nullable: true,
                        description: 'Emoji for error state',
                    },
                    emojiMode: {
                        type: 'string',
                        default: 'inline',
                        nullable: true,
                        description: 'Emoji display mode: inline or reaction',
                    },
                    delivery: {
                        type: 'string',
                        default: 'channel',
                        nullable: true,
                        description: 'Delivery method: channel or dm',
                    },
                },
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
    roles: {
        type: 'object',
        default: {
            addRoleId: null,
            removeRoleId: null,
        },
        description: 'Role management configuration',
        nested: {
            addRoleId: {
                type: 'string',
                default: null,
                nullable: true,
                description: 'Role ID to add on successful introduction',
            },
            removeRoleId: {
                type: 'string',
                default: null,
                nullable: true,
                description: 'Role ID to remove on successful introduction',
            },
        },
    },
    introducedUsers: {
        type: 'array',
        default: [],
        description: 'Array of user IDs who have been introduced',
    },
    triggerWord: {
        type: 'string',
        default: null,
        nullable: true,
        description: 'Optional trigger word to execute the introduction',
    },
};

/**
 * Ensure config has the proper structure with all required fields
 * Migrate old fields to new structure if they exist
 */
export function ensureDefaultConfig(existingConfig = {}) {
    // Handle legacy emoji format (string) -> new format (object)
    let emojiConfig = existingConfig.message?.emoji ?? existingConfig.emoji;
    if (typeof emojiConfig === 'string') {
        // Migrate from old string format to new object format
        emojiConfig = {
            success: emojiConfig,
            already: moduleSchema.message.default.emoji.already,
            error: moduleSchema.message.default.emoji.error,
        };
    } else if (!emojiConfig || typeof emojiConfig !== 'object') {
        emojiConfig = moduleSchema.message.default.emoji;
    } else {
        // Ensure all properties exist
        emojiConfig = {
            success: emojiConfig.success ?? moduleSchema.message.default.emoji.success,
            already: emojiConfig.already ?? moduleSchema.message.default.emoji.already,
            error: emojiConfig.error ?? moduleSchema.message.default.emoji.error,
        };
    }

    const defaults = {
        enabled: existingConfig.enabled ?? moduleSchema.enabled.default,
        channelId: existingConfig.channelId ?? moduleSchema.channelId.default,
        message: {
            type: existingConfig.message?.type ?? existingConfig.message ?? moduleSchema.message.default.type,
            content: existingConfig.message?.content ?? moduleSchema.message.default.content,
            emoji: emojiConfig,
            delivery: existingConfig.message?.delivery ?? moduleSchema.message.default.delivery,
            emojiMode: existingConfig.message?.emojiMode ?? moduleSchema.message.default.emojiMode,
        },
        embed: {
            enabled: existingConfig.embed?.enabled ?? existingConfig.embedEnabled ?? moduleSchema.embed.default.enabled,
            title: existingConfig.embed?.title ?? moduleSchema.embed.default.title,
            description: existingConfig.embed?.description ?? moduleSchema.embed.default.description,
            color: existingConfig.embed?.color ?? moduleSchema.embed.default.color,
            image: existingConfig.embed?.image ?? moduleSchema.embed.default.image,
            thumbnail: existingConfig.embed?.thumbnail ?? moduleSchema.embed.default.thumbnail,
        },
        roles: {
            addRoleId: existingConfig.roles?.addRoleId ?? moduleSchema.roles.default.addRoleId,
            removeRoleId: existingConfig.roles?.removeRoleId ?? moduleSchema.roles.default.removeRoleId,
        },
        introducedUsers: existingConfig.introducedUsers ?? moduleSchema.introducedUsers.default,
        triggerWord: existingConfig.triggerWord ?? moduleSchema.triggerWord.default,
    };
    return defaults;
}
