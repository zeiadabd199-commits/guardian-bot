export const moduleSchema = {
    enabled: {
        type: 'boolean',
        default: false,
        description: 'Enable/disable the introduce (verification) module',
    },
    verifyChannelId: {
        type: 'string',
        default: null,
        description: 'Channel ID where verification messages should be posted (verify channel)',
    },
    triggerWord: {
        type: 'string',
        default: null,
        nullable: true,
        description: 'Trigger word that users must type to verify (case-insensitive exact match)',
    },
    message: {
        type: 'object',
        default: {
            success: 'You have been verified. Welcome!',
            already: 'You are already verified.',
            error: 'Incorrect verification word. Please try again.',
            dm: 'Welcome! To complete verification, please write the verification word in the verify channel.',
            delivery: 'channel', // 'channel' | 'dm'
            emojiMode: true,
            reactions: {
                success: '✅',
                error: '❌',
                already: '⚠️',
            },
        },
        description: 'Messages and reaction configuration used during verification',
    },
    embed: {
        type: 'object',
        default: {
            enabled: false,
            title: 'Welcome',
            description: 'Welcome to the server!',
            color: '#0099FF',
            image: null,
            thumbnail: null,
        },
        description: 'Embed display configuration (optional)',
    },
    roles: {
        type: 'object',
        default: {
            verifyRoleId: null,
            pendingRoleId: null,
            removeRoleId: null,
        },
        description: 'Role IDs used for verification: verify, pending, optional remove role',
    },
};

/**
 * Ensure config has the proper structure with all required fields
 * Migrate old fields to new structure if they exist
 */
export function ensureDefaultConfig(existingConfig = {}) {
    const defaults = {
        enabled: existingConfig.enabled ?? moduleSchema.enabled.default,
        verifyChannelId: existingConfig.verifyChannelId ?? existingConfig.channelId ?? null,
        triggerWord: existingConfig.triggerWord ?? existingConfig.trigger?.word ?? null,
        message: {
            success: existingConfig.message?.success ?? existingConfig.message?.content ?? moduleSchema.message.default.success,
            already: existingConfig.message?.already ?? moduleSchema.message.default.already,
            error: existingConfig.message?.error ?? moduleSchema.message.default.error,
            dm: existingConfig.message?.dm ?? moduleSchema.message.default.dm,
            delivery: existingConfig.message?.delivery ?? moduleSchema.message.default.delivery,
            emojiMode: typeof existingConfig.message?.emojiMode === 'boolean' ? existingConfig.message.emojiMode : moduleSchema.message.default.emojiMode,
            reactions: {
                success: existingConfig.message?.reactions?.success ?? moduleSchema.message.default.reactions.success,
                error: existingConfig.message?.reactions?.error ?? moduleSchema.message.default.reactions.error,
                already: existingConfig.message?.reactions?.already ?? moduleSchema.message.default.reactions.already,
            },
        },
        embed: {
            enabled: existingConfig.embed?.enabled ?? moduleSchema.embed.default.enabled,
            title: existingConfig.embed?.title ?? moduleSchema.embed.default.title,
            description: existingConfig.embed?.description ?? moduleSchema.embed.default.description,
            color: existingConfig.embed?.color ?? moduleSchema.embed.default.color,
            image: existingConfig.embed?.image ?? moduleSchema.embed.default.image,
            thumbnail: existingConfig.embed?.thumbnail ?? moduleSchema.embed.default.thumbnail,
        },
        roles: {
            verifyRoleId: existingConfig.roles?.verifyRoleId ?? existingConfig.roles?.addRoleId ?? null,
            pendingRoleId: existingConfig.roles?.pendingRoleId ?? existingConfig.roles?.pendingId ?? null,
            removeRoleId: existingConfig.roles?.removeRoleId ?? existingConfig.roles?.removeRoleId ?? null,
        },
    };

    // Normalize triggerWord to trimmed lowercase for consistent comparisons when storing
    if (typeof defaults.triggerWord === 'string') {
        defaults.triggerWord = defaults.triggerWord.trim();
    }

    return defaults;
}
