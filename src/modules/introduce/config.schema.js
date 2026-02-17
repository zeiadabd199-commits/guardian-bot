export const moduleSchema = {
    enabled: {
        type: 'boolean',
        default: false,
        description: 'Enable/disable the introduce (verification) module',
    },
    verifyChannelId: {
        type: 'string',
        default: null,
        description: 'Channel ID where verification messages should be posted',
    },
    triggerWord: {
        type: 'string',
        default: null,
        nullable: true,
        description: 'Trigger word that users must type to verify (case-insensitive exact match)',
    },
    messages: {
        type: 'object',
        default: {
            success: {
                text: 'You have been verified. Welcome!',
                embed: {
                    enabled: false,
                    title: 'Verified',
                    description: 'Welcome to the server!',
                    color: '#00FF00',
                    image: null,
                    thumbnail: null,
                },
                delivery: 'channel',
                reaction: '✅',
            },
            already: {
                text: 'You are already verified.',
                embed: {
                    enabled: false,
                    title: 'Already Verified',
                    description: 'You have already completed verification.',
                    color: '#FFA500',
                    image: null,
                    thumbnail: null,
                },
                delivery: 'channel',
                reaction: '⚠️',
            },
            error: {
                text: 'Incorrect verification word. Please try again.',
                embed: {
                    enabled: false,
                    title: 'Verification Failed',
                    description: 'The verification word was incorrect.',
                    color: '#FF0000',
                    image: null,
                    thumbnail: null,
                },
                delivery: 'channel',
                reaction: '❌',
            },
            dm_prompt: {
                text: 'Welcome! To complete verification, please write the verification word in the verify channel.',
                embed: {
                    enabled: false,
                    title: 'Verification Required',
                    description: 'Please complete the verification challenge.',
                    color: '#0099FF',
                    image: null,
                    thumbnail: null,
                },
                delivery: 'dm',
                reaction: null,
            },
        },
        description: 'State-specific message configurations with independent embeds and delivery modes',
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
 * Migrate old fields to new nested messages structure if they exist
 * Full backward compatibility with legacy config format
 */
export function ensureDefaultConfig(existingConfig = {}) {
    // Start with legacy field support
    const legacyMessage = existingConfig.message || {};
    const legacyEmbed = existingConfig.embed || {};
    const legacyReactions = legacyMessage.reactions || {};
    const legacyDelivery = legacyMessage.delivery || 'channel';
    const legacyEmojiMode = legacyMessage.emojiMode !== false;

    const createStateMessage = (stateKey, defaultText, defaultReaction = null) => {
        let stateText = defaultText;
        let stateReaction = defaultReaction;
        let stateEmbed = {
            enabled: false,
            title: 'Verification',
            description: 'Please complete verification.',
            color: '#0099FF',
            image: null,
            thumbnail: null,
        };
        let stateDelivery = legacyDelivery;

        if (existingConfig.messages?.[stateKey]) {
            const existingState = existingConfig.messages[stateKey];
            stateText = existingState.text ?? stateText;
            stateReaction = existingState.reaction ?? stateReaction;
            stateDelivery = existingState.delivery ?? stateDelivery;
            stateEmbed = existingState.embed ? { ...stateEmbed, ...existingState.embed } : stateEmbed;
        } else {
            if (stateKey === 'success') {
                stateText = legacyMessage.success ?? defaultText;
                stateReaction = legacyEmojiMode ? (legacyReactions.success ?? defaultReaction) : defaultReaction;
                if (legacyEmbed && legacyEmbed.enabled) {
                    stateEmbed = {
                        enabled: true,
                        title: legacyEmbed.title ?? stateEmbed.title,
                        description: legacyEmbed.description ?? stateEmbed.description,
                        color: legacyEmbed.color ?? stateEmbed.color,
                        image: legacyEmbed.image ?? stateEmbed.image,
                        thumbnail: legacyEmbed.thumbnail ?? stateEmbed.thumbnail,
                    };
                }
            } else if (stateKey === 'already') {
                stateText = legacyMessage.already ?? defaultText;
                stateReaction = legacyEmojiMode ? (legacyReactions.already ?? defaultReaction) : defaultReaction;
            } else if (stateKey === 'error') {
                stateText = legacyMessage.error ?? defaultText;
                stateReaction = legacyEmojiMode ? (legacyReactions.error ?? defaultReaction) : defaultReaction;
            } else if (stateKey === 'dm_prompt') {
                stateText = legacyMessage.dm ?? defaultText;
                stateReaction = null;
                stateDelivery = 'dm';
            }
        }

        return {
            text: stateText,
            embed: stateEmbed,
            delivery: stateDelivery,
            reaction: stateReaction,
        };
    };

    const messages = {
        success: createStateMessage('success', moduleSchema.messages.default.success.text, '✅'),
        already: createStateMessage('already', moduleSchema.messages.default.already.text, '⚠️'),
        error: createStateMessage('error', moduleSchema.messages.default.error.text, '❌'),
        dm_prompt: createStateMessage('dm_prompt', moduleSchema.messages.default.dm_prompt.text, null),
    };

    let triggerWord = existingConfig.triggerWord ?? existingConfig.trigger?.word ?? null;
    if (typeof triggerWord === 'string') {
        triggerWord = triggerWord.trim();
    }

    return {
        enabled: existingConfig.enabled ?? moduleSchema.enabled.default,
        verifyChannelId: existingConfig.verifyChannelId ?? existingConfig.channelId ?? null,
        triggerWord: triggerWord,
        messages: messages,
        roles: {
            verifyRoleId: existingConfig.roles?.verifyRoleId ?? existingConfig.roles?.addRoleId ?? null,
            pendingRoleId: existingConfig.roles?.pendingRoleId ?? existingConfig.roles?.pendingId ?? null,
            removeRoleId: existingConfig.roles?.removeRoleId ?? null,
        },
    };
}
