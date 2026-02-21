import mongoose from 'mongoose';
const { Schema } = mongoose;

const PANIC_MODE = ['OFF', 'LOW', 'HIGH', 'LOCKDOWN'];
const GATEWAY_TYPES = ['SLASH', 'TRIGGER', 'BUTTON', 'REACTION'];

const GuildConfigSchema = new Schema(
  {
      guildId: { type: String, required: true, unique: true, index: true },

          security: {
                antiNuke: { type: Boolean, required: true, default: true },
                      panicMode: { type: String, enum: PANIC_MODE, required: true, default: 'OFF' },
                            trustScoreSystem: { type: Boolean, required: true, default: true },
                                },

                                    gateway: {
                                          enabled: { type: Boolean, required: true, default: false },
                                                type: { type: String, enum: GATEWAY_TYPES, required: true, default: 'BUTTON' },
                                                    verifiedRoleId: { type: String, default: null },
                                                        logChannelId: { type: String, default: null },
                                                        settings: { type: Schema.Types.Mixed, default: {} },
                                                                },

                                                                    tickets: {
                                                                          enabled: { type: Boolean, required: true, default: false },
                                                                                categoryId: { type: String, default: null },
                                                                                      vipOnly: { type: Boolean, required: true, default: false },
                                                                                          },
                                                                                            },
                                                                                              {
                                                                                                  timestamps: true,
                                                                                                      strict: true,
                                                                                                          versionKey: false,
                                                                                                            }
                                                                                                            );

                                                                                                            const GuildConfig = mongoose.models.GuildConfig || mongoose.model('GuildConfig', GuildConfigSchema);
                                                                                                            export default GuildConfig;
                                                                                                            