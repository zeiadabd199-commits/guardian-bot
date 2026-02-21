import mongoose from 'mongoose';
const { Schema } = mongoose;
const TRUST_LEVELS = ['TRUSTED', 'NEUTRAL', 'SUSPICIOUS', 'DANGER'];
const UserConfigSchema = new Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  trust: { score: { type: Number, default: 100 }, level: { type: String, enum: TRUST_LEVELS, default: 'NEUTRAL' } },
  gateway: { isVerified: { type: Boolean, default: false }, verifiedAt: { type: Date, default: null } },
  security: { warnings: { type: Number, default: 0 }, isShadowBanned: { type: Boolean, default: false } }
}, { timestamps: true, strict: true, versionKey: false });
UserConfigSchema.index({ userId: 1, guildId: 1 }, { unique: true });
export default mongoose.models.UserConfig || mongoose.model('UserConfig', UserConfigSchema);
