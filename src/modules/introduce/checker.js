import { checkAdminPermission } from '../../core/permissions.js';

export async function isModuleEnabled(config) {
    if (!config || !config.modules) return false;
    return config.modules.introduce?.enabled === true;
}

export async function checkPermission(interaction) {
    return await checkAdminPermission(interaction);
}

export async function validateGuildConfig(config) {
    if (!config) return false;
    const introduce = config.modules?.introduce;
    return introduce && typeof introduce.enabled === 'boolean';
}
