import { checkAdminPermission } from '../../core/permissions.js';

export async function isModuleEnabled(config) {
    if (!config || !config.modules) return false;
    return config.modules.gateway?.enabled === true;
}

export async function checkPermission(interaction) {
    return await checkAdminPermission(interaction);
}

export async function validateGuildConfig(config) {
    if (!config) return false;
    const gateway = config.modules?.gateway;
    return gateway && typeof gateway.enabled === 'boolean' && Array.isArray(gateway.systems);
}
