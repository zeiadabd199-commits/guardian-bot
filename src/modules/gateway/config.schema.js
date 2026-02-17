export const moduleSchema = {
    enabled: {
        type: 'boolean',
        default: false,
        description: 'Enable/disable the gateway module',
    },
    channelId: {
        type: 'string',
        default: null,
        description: 'Primary channel for gateway interactions',
    },

    // Mode engine - single verification entry point with 4 modes
    mode: {
        type: 'object',
        default: {
            type: 'trigger', // trigger | button | reaction | slash
            triggerWord: 'verify',
            buttonLabel: 'Verify',
            reactionEmoji: '✅',
        },
        description: 'Verification mode and parameters',
    },

    // Message and delivery configuration
    message: {
        type: 'object',
        default: {
            type: 'text', // text | embed
            content: 'Welcome to the server! Use {mention} to start verification.',
            emoji: { success: '✅', already: '⚠️', error: '❌' },
            delivery: 'channel', // channel | dm | both
            emojiMode: 'inline', // inline | reaction
        },
        description: 'Verification message configuration',
    },

    // CENTRALIZED EMBED SYSTEM - Public embed (shown in channel)
    embedPublic: {
        type: 'object',
        default: {
            enabled: true,
            title: 'Verification',
            description: 'Welcome to our server! Please verify to gain access.',
            color: '#0099FF',
            thumbnailUrl: null,
            imageUrl: null,
            footerText: null,
        },
        description: 'Public embed configuration for channel messages',
    },

    // CENTRALIZED EMBED SYSTEM - DM embed (sent to user)
    embedDM: {
        type: 'object',
        default: {
            enabled: true,
            title: 'Please Verify',
            description: 'Complete verification to access the server.',
            color: '#0099FF',
            thumbnailUrl: null,
            imageUrl: null,
            footerText: null,
        },
        description: 'DM embed configuration for direct messages',
    },

    // Welcome message configuration (for new members)
    welcomeMessage: {
        type: 'object',
        default: {
            enabled: false,
            channelId: null,
            dmEnabled: false,
            type: 'text', // text | embed
            content: 'Welcome {mention} to {server}!',
            useEmbed: false,
            embedTitle: 'Welcome!',
            embedDescription: 'Thanks for joining {server}!',
            embedColor: '#00FF00',
        },
        description: 'Welcome message for new members',
    },

    // Auto-role assignment for new users
    autoRoleOnJoin: {
        type: 'object',
        default: {
            enabled: false,
            roleIds: [], // Roles to automatically assign on join
        },
        description: 'Automatically assign roles to new members on join',
    },

    // Security engine
    security: {
        type: 'object',
        default: {
            minAccountAgeDays: 3,
            minJoinMinutes: 5,
            rateLimitPerMinute: 3,
            autoLockOnRaid: true,
            raidThresholdPerMinute: 15,
            lockDurationMinutes: 10,
        },
        description: 'Security thresholds and rate-limits',
    },

    // Role flow
    roles: {
        type: 'object',
        default: {
            verifiedRoleId: null,
            suspiciousRoleId: null,
            newAccountRoleId: null,
            bypassRoles: [],
        },
        description: 'Role decision engine configuration',
    },

    // Logs
    logs: {
        type: 'object',
        default: {
            enabled: true,
            channelId: null,
        },
        description: 'Logging configuration for gateway attempts',
    },

    // Stats
    stats: {
        type: 'object',
        default: {
            totalVerified: 0,
            totalBlocked: 0,
            todayVerified: 0,
            todayBlocked: 0,
            gatewayLocked: false,
            lockUntil: null,
        },
        description: 'Gateway statistics',
    },

    // User tracking
    introducedUsers: {
        type: 'array',
        default: [],
        description: 'Array of user IDs who have been verified',
    },
    memberScores: {
        type: 'object',
        default: {},
        description: 'Trust scores for members',
    },

    // Backwards compatibility
    triggerWord: { type: 'string', default: null, nullable: true, description: 'Legacy triggerWord (backwards compat)' },
};

/**
 * Ensure config has the proper structure with all required fields
 * and migrate older introduce configs to the new gateway schema.
 */
export function ensureDefaultConfig(existingConfig = {}) {
    // deep clone to avoid mutation
    const clone = JSON.parse(JSON.stringify(existingConfig || {}));

    // Merge with defaults
    const defaults = moduleSchema;

    const merged = {
        enabled: clone.enabled ?? defaults.enabled.default,
        channelId: clone.channelId ?? defaults.channelId.default,
        mode: {
            type: clone.mode?.type ?? (clone.triggerWord ? 'trigger' : defaults.mode.default.type),
            triggerWord: clone.mode?.triggerWord ?? clone.triggerWord ?? defaults.mode.default.triggerWord,
            buttonLabel: clone.mode?.buttonLabel ?? defaults.mode.default.buttonLabel,
            reactionEmoji: clone.mode?.reactionEmoji ?? defaults.mode.default.reactionEmoji,
        },
        message: {
            type: clone.message?.type ?? defaults.message.default.type,
            content: clone.message?.content ?? clone.message ?? defaults.message.default.content,
            emoji: {
                success: clone.message?.emoji?.success ?? defaults.message.default.emoji.success,
                already: clone.message?.emoji?.already ?? defaults.message.default.emoji.already,
                error: clone.message?.emoji?.error ?? defaults.message.default.emoji.error,
            },
            delivery: clone.message?.delivery ?? defaults.message.default.delivery,
            emojiMode: clone.message?.emojiMode ?? defaults.message.default.emojiMode,
        },
        embedPublic: {
            enabled: clone.embedPublic?.enabled ?? clone.embed?.enabled ?? defaults.embedPublic.default.enabled,
            title: clone.embedPublic?.title ?? clone.embed?.title ?? defaults.embedPublic.default.title,
            description: clone.embedPublic?.description ?? clone.embed?.description ?? defaults.embedPublic.default.description,
            color: clone.embedPublic?.color ?? clone.embed?.color ?? defaults.embedPublic.default.color,
            thumbnailUrl: clone.embedPublic?.thumbnailUrl ?? clone.embed?.thumbnail ?? null,
            imageUrl: clone.embedPublic?.imageUrl ?? clone.embed?.image ?? null,
            footerText: clone.embedPublic?.footerText ?? null,
        },
        embedDM: {
            enabled: clone.embedDM?.enabled ?? true,
            title: clone.embedDM?.title ?? defaults.embedDM.default.title,
            description: clone.embedDM?.description ?? defaults.embedDM.default.description,
            color: clone.embedDM?.color ?? defaults.embedDM.default.color,
            thumbnailUrl: clone.embedDM?.thumbnailUrl ?? null,
            imageUrl: clone.embedDM?.imageUrl ?? null,
            footerText: clone.embedDM?.footerText ?? null,
        },
        welcomeMessage: {
            enabled: clone.welcomeMessage?.enabled ?? false,
            channelId: clone.welcomeMessage?.channelId ?? null,
            dmEnabled: clone.welcomeMessage?.dmEnabled ?? false,
            type: clone.welcomeMessage?.type ?? 'text',
            content: clone.welcomeMessage?.content ?? defaults.welcomeMessage.default.content,
            useEmbed: clone.welcomeMessage?.useEmbed ?? false,
            embedTitle: clone.welcomeMessage?.embedTitle ?? defaults.welcomeMessage.default.embedTitle,
            embedDescription: clone.welcomeMessage?.embedDescription ?? defaults.welcomeMessage.default.embedDescription,
            embedColor: clone.welcomeMessage?.embedColor ?? defaults.welcomeMessage.default.embedColor,
        },
        autoRoleOnJoin: {
            enabled: clone.autoRoleOnJoin?.enabled ?? false,
            roleIds: Array.isArray(clone.autoRoleOnJoin?.roleIds) ? clone.autoRoleOnJoin.roleIds : [],
        },
        security: {
            minAccountAgeDays: clone.security?.minAccountAgeDays ?? defaults.security.default.minAccountAgeDays,
            minJoinMinutes: clone.security?.minJoinMinutes ?? defaults.security.default.minJoinMinutes,
            rateLimitPerMinute: clone.security?.rateLimitPerMinute ?? defaults.security.default.rateLimitPerMinute,
            autoLockOnRaid: clone.security?.autoLockOnRaid ?? defaults.security.default.autoLockOnRaid,
            raidThresholdPerMinute: clone.security?.raidThresholdPerMinute ?? defaults.security.default.raidThresholdPerMinute,
            lockDurationMinutes: clone.security?.lockDurationMinutes ?? defaults.security.default.lockDurationMinutes,
        },
        roles: {
            verifiedRoleId: clone.roles?.verifiedRoleId ?? clone.roles?.addRoleId ?? null,
            suspiciousRoleId: clone.roles?.suspiciousRoleId ?? null,
            newAccountRoleId: clone.roles?.newAccountRoleId ?? null,
            bypassRoles: Array.isArray(clone.roles?.bypassRoles) ? clone.roles.bypassRoles : (clone.roles?.bypassRole ? [clone.roles.bypassRole] : []),
        },
        logs: {
            enabled: clone.logs?.enabled ?? defaults.logs.default.enabled,
            channelId: clone.logs?.channelId ?? null,
        },
        stats: {
            totalVerified: clone.stats?.totalVerified ?? 0,
            totalBlocked: clone.stats?.totalBlocked ?? 0,
            todayVerified: clone.stats?.todayVerified ?? 0,
            todayBlocked: clone.stats?.todayBlocked ?? 0,
            gatewayLocked: clone.stats?.gatewayLocked ?? false,
            lockUntil: clone.stats?.lockUntil ?? null,
        },
        introducedUsers: Array.isArray(clone.introducedUsers) ? clone.introducedUsers : [],
        memberScores: typeof clone.memberScores === 'object' ? clone.memberScores : {},
        triggerWord: clone.triggerWord ?? null,
    };

    return merged;
}
