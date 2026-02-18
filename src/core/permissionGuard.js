import { logger } from './logger.js';

function _fail(message) {
    logger.warn(message);
    const err = new Error(message);
    err.name = 'PermissionGuardError';
    throw err;
}

export function requireAdmin(interaction) {
    const member = interaction.member;
    if (!member) _fail('Missing member on interaction');
    if (member.permissions && member.permissions.has && member.permissions.has('Administrator')) return true;
    _fail('Administrator permission required');
}

export function requireManageGuild(interaction) {
    const member = interaction.member;
    if (!member) _fail('Missing member on interaction');
    if (member.permissions && member.permissions.has && member.permissions.has('ManageGuild')) return true;
    _fail('Manage Guild permission required');
}

export function requireRolePosition(botMember, role) {
    if (!botMember || !botMember.roles || !botMember.roles.highest) {
        _fail('Bot member information required to check role positions');
    }
    if (!role || typeof role.position !== 'number') {
        _fail('Role object with position required');
    }
    const botPos = botMember.roles.highest.position || 0;
    const rolePos = role.position || 0;
    if (botPos > rolePos) return true;
    _fail('Bot role position not high enough to manage the target role');
}

export default {
    requireAdmin,
    requireManageGuild,
    requireRolePosition,
};
