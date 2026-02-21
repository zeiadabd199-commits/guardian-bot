import mongoose from 'mongoose';
const { Schema } = mongoose;
const PANIC_MODE = ['OFF', 'LOW', 'HIGH', 'LOCKDOWN'];
const GATEWAY_TYPES = ['SLASH', 'TRIGGER', 'BUTTON', 'REACTION'];
const GuildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  security: { antiNuke: { type: Boolean, default: true }, panicMode: { type: String, enum: PANIC_MODE, default: 'OFF' }, trustScoreSystem: { type: Boolean, default: true } },
  gateway: {
    enabled: { type: Boolean, default: false },
    type: { type: String, enum: GATEWAY_TYPES, default: 'BUTTON' },
    verifiedRoleId: { type: String, default: null },
    logChannelId: { type: String, default: null },
    settings: {
      BUTTON: {
        roleId: { type: String, default: null },
        channelId: { type: String, default: null },
        embedText: { type: String, default: null },
        buttonLabel: { type: String, default: 'Verify' },
        buttonStyle: { type: String, enum: ['Primary', 'Secondary', 'Success', 'Danger'], default: 'Primary' }
      },
      REACTION: {
        roleId: { type: String, default: null },
        channelId: { type: String, default: null },
        embedText: { type: String, default: null },
        emoji: { type: String, default: '✅' }
      },
      TRIGGER: {
        roleId: { type: String, default: null },
        channelId: { type: String, default: null },
        triggerWord: { type: String, default: 'verify' },
        instructionText: { type: String, default: null }
      },
      SLASH: {
        roleId: { type: String, default: null },
        channelId: { type: String, default: null },
        instructionText: { type: String, default: null }
      }
    }
  },
  tickets: { enabled: { type: Boolean, default: false }, categoryId: { type: String, default: null }, vipOnly: { type: Boolean, default: false } }
}, { timestamps: true, strict: true, versionKey: false });
export default mongoose.models.GuildConfig || mongoose.model('GuildConfig', GuildConfigSchema);
