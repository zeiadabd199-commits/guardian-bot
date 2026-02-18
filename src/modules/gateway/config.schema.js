export const moduleSchema = {
    enabled: { type: 'boolean', default: false, description: 'Enable/disable the gateway module' },

    // New systems: up to 5 per guild
    systems: {
        type: 'array',
        default: [],
        description: 'Array of verification systems (max 5)'
    },

    // Legacy/compat fields kept for migration and compatibility
    // (will be migrated into a default system when needed)
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
    },
    introducedUsers: { type: 'array', default: [] },
    memberScores: { type: 'object', default: {} },
    // backward compat old fields
    channelId: { type: 'string', default: null },
    mode: { type: 'object', default: null },
    message: { type: 'object', default: null },
    roles: { type: 'object', default: null },
    security: { type: 'object', default: null },
    logs: { type: 'object', default: null },
    // allow simple triggerWord for compat
    triggerWord: { type: 'string', default: null },
};

function cloneDeep(obj) { return JSON.parse(JSON.stringify(obj || {})); }

function migrateLegacyToSystem(clone) {
    // Create a default system object from legacy fields
    const mode = clone.mode || {};
    const message = clone.message || {};
    const roles = clone.roles || {};
    const security = clone.security || {};

    return {
        id: 'default',
        type: (mode.type === 'button' || mode.type === 'reaction' || mode.type === 'slash' || mode.type === 'text' || mode.type === 'trigger') ? mode.type : (mode.triggerWord ? 'trigger' : 'button'),
        channelId: clone.channelId || null,
        verifyRoleAdd: roles.verifiedRoleId || null,
        verifyRoleRemove: null,
        triggerText: mode.triggerWord || clone.triggerWord || null,
        reactionEmoji: mode.reactionEmoji || (message?.emoji?.success) || null,
        successMessage: (message?.content) || 'Verified',
        failMessage: message?.emoji?.error || 'Verification failed',
        alreadyVerifiedMessage: message?.emoji?.already || 'Already verified',
        dmSuccessMessage: (clone.embedDM?.description) || null,
        enabled: clone.enabled ?? true,
    };
}

export function ensureDefaultConfig(existingConfig = {}) {
    const clone = cloneDeep(existingConfig);

    const merged = {
        enabled: clone.enabled ?? false,
        systems: Array.isArray(clone.systems) ? clone.systems.slice(0,5) : [],
        stats: clone.stats ?? moduleSchema.stats.default,
        introducedUsers: Array.isArray(clone.introducedUsers) ? clone.introducedUsers : [],
        memberScores: typeof clone.memberScores === 'object' && clone.memberScores !== null ? clone.memberScores : {},
        // keep legacy fields for compatibility
        channelId: clone.channelId ?? null,
        mode: clone.mode ?? null,
        message: clone.message ?? null,
        roles: clone.roles ?? null,
        security: clone.security ?? null,
        logs: clone.logs ?? null,
        triggerWord: clone.triggerWord ?? null,
    };

    // If no systems defined but legacy config exists, migrate into a default system
    if ((!merged.systems || merged.systems.length === 0) && (clone.mode || clone.message || clone.roles || clone.channelId || clone.triggerWord)) {
        merged.systems = [ migrateLegacyToSystem(clone) ];
    }

    return merged;
}
