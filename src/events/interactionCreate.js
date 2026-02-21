import { Events, InteractionType } from 'discord.js';
import { logger } from '../core/logger.js';
import { performVerify } from '../core/gatewayLogic.js';
export default {
        name: Events.InteractionCreate,
            async execute(interaction, client) {
                        try {
                                        if (interaction.isChatInputCommand()) {
                                                            const command = client.commands.get(interaction.commandName);
                                                                            if (!command) return;
                                                                                            await command.execute(interaction);
                                        } else if (interaction.type === InteractionType.MessageComponent && interaction.customId === 'gateway_verify_btn') {
                                                            await interaction.deferReply({ ephemeral: true });
                                                                            const result = await performVerify(interaction.guild, interaction.user, client, 'BUTTON');
                                                                                            if (!result.ok) return interaction.editReply({ content: 'Verification failed. Please contact an admin.' });
                                                                                                            await interaction.editReply({ content: result.already ? 'You are already verified.' : 'Verification successful! Welcome!' });
                                        }
                        } catch (error) { logger.error(`Interaction Error: ${error.message}`); }
            }
};
