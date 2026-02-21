import mongoose from 'mongoose';
const { Schema } = mongoose;
const PANIC_MODE = ['OFF', 'LOW', 'HIGH', 'LOCKDOWN'];
const GATEWAY_TYPES = ['SLASH', 'TRIGGER', 'BUTTON', 'REACTION'];
const GuildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  security: { antiNuke: { type: Boolean, default: true }, panicMode: { type: String, enum: PANIC_MODE, default: 'OFF' }, trustScoreSystem: { type: Boolean, default: true } },
  gateway: { enabled: { type: Boolean, default: false }, type: { type: String, enum: GATEWAY_TYPES, default: 'BUTTON' }, verifiedRoleId: { type: String, default: null }, logChannelId: { type: String, default: null } },
  tickets: { enabled: { type: Boolean, default: false }, categoryId: { type: String, default: null }, vipOnly: { type: Boolean, default: false } }
}, { timestamps: true, strict: true, versionKey: false });
export default mongoose.models.GuildConfig || mongoose.model('GuildConfig', GuildConfigSchema);
