import dotenv from 'dotenv';
dotenv.config();

export const env = {
    TOKEN: process.env.TOKEN || '',
    CLIENT_ID: process.env.CLIENT_ID || '',
    GUILD_ID: process.env.GUILD_ID || '',
    PORT: parseInt(process.env.PORT || '5000', 10),
    MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/guardian',
};

if (!env.TOKEN) {
    console.warn('WARNING: Discord TOKEN is missing from environment.');
}
