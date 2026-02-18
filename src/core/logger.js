export const logger = {
    info: (msg) => console.log(`[${new Date().toISOString()}] [INFO] ${msg}`),
    warn: (msg) => console.warn(`[${new Date().toISOString()}] [WARN] ${msg}`),
    error: (msg) => console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`),
    security: (msg) => console.warn(`[${new Date().toISOString()}] [SECURITY] ${msg}`)
};
