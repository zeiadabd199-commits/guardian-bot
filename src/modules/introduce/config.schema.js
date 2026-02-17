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

        export const moduleSchema = {
            enabled: { type: 'boolean', default: false, description: 'Enable/disable the gateway module' },
            channelId: { type: 'string', default: null, description: 'Primary channel for gateway interactions' },

            // Mode engine
            mode: {
                type: 'object',
                default: {
                    type: 'trigger', // trigger | button | reaction | slash
                    triggerWord: 'verify',
                    buttonLabel: 'Verify',
                    reactionEmoji: '✅',
                },
                description: 'Verification mode and parameters',
                nested: {
                    type: { type: 'string', default: 'trigger', description: 'Mode type' },
                    triggerWord: { type: 'string', default: 'verify', nullable: true, description: 'Word to trigger verification' },
                    buttonLabel: { type: 'string', default: 'Verify', nullable: true, description: 'Label for verification button' },
                    reactionEmoji: { type: 'string', default: '✅', nullable: true, description: 'Emoji for reaction mode' },
                },
            },

            // Message and delivery
            message: {
                type: 'object',
                default: {
                    type: 'text',
                    content: 'Welcome to the server! Use {mention} to start verification.',
                    emoji: { success: '👋', already: '⚠️', error: '❌' },
                    delivery: 'channel', // channel | dm | both
                    emojiMode: 'inline', // inline | reaction
                },
                description: 'Message and delivery configuration',
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

            introducedUsers: { type: 'array', default: [], description: 'Array of user IDs who have been introduced/verified' },
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
                    emoji: (clone.message && clone.message.emoji) || clone.message?.emoji || defaults.message.default.emoji,
                    delivery: clone.message?.delivery ?? defaults.message.default.delivery,
                    emojiMode: clone.message?.emojiMode ?? defaults.message.default.emojiMode,
                },
                embed: {
                    enabled: clone.embed?.enabled ?? clone.embedEnabled ?? defaults.embed.default.enabled,
                    title: clone.embed?.title ?? defaults.embed.default.title,
                    description: clone.embed?.description ?? defaults.embed.default.description,
                    color: clone.embed?.color ?? defaults.embed.default.color,
                    image: clone.embed?.image ?? defaults.embed.default.image,
                    thumbnail: clone.embed?.thumbnail ?? defaults.embed.default.thumbnail,
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
                    verifiedRoleId: clone.roles?.verifiedRoleId ?? clone.roles?.addRoleId ?? defaults.roles.default.verifiedRoleId,
                    suspiciousRoleId: clone.roles?.suspiciousRoleId ?? defaults.roles.default.suspiciousRoleId,
                    newAccountRoleId: clone.roles?.newAccountRoleId ?? defaults.roles.default.newAccountRoleId,
                    bypassRoles: clone.roles?.bypassRoles ?? clone.roles?.bypassRole ? [clone.roles.bypassRole] : defaults.roles.default.bypassRoles,
                },
                logs: {
                    enabled: clone.logs?.enabled ?? defaults.logs.default.enabled,
                    channelId: clone.logs?.channelId ?? defaults.logs.default.channelId,
                },
                stats: {
                    totalVerified: clone.stats?.totalVerified ?? defaults.stats.default.totalVerified,
                    totalBlocked: clone.stats?.totalBlocked ?? defaults.stats.default.totalBlocked,
                    todayVerified: clone.stats?.todayVerified ?? defaults.stats.default.todayVerified,
                    todayBlocked: clone.stats?.todayBlocked ?? defaults.stats.default.todayBlocked,
                    gatewayLocked: clone.stats?.gatewayLocked ?? defaults.stats.default.gatewayLocked,
                    lockUntil: clone.stats?.lockUntil ?? defaults.stats.default.lockUntil,
                },
                introducedUsers: clone.introducedUsers ?? defaults.introducedUsers.default,
                triggerWord: clone.triggerWord ?? null,
            };

            // Ensure emoji object has keys
            const emo = merged.message.emoji || defaults.message.default.emoji;
            merged.message.emoji = {
                success: emo.success ?? defaults.message.default.emoji.success,
                already: emo.already ?? defaults.message.default.emoji.already,
                error: emo.error ?? defaults.message.default.emoji.error,
            };

            return merged;
        }
