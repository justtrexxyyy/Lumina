const { createEmbed, errorEmbed, successEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
                
                const errorResponse = {
                    embeds: [errorEmbed('There was an error while executing this command!')],
                    ephemeral: true
                };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorResponse);
                } else {
                    await interaction.reply(errorResponse);
                }
            }
        }
        
        // Handle button interactions
        if (interaction.isButton()) {
            const { client, guild } = interaction;
            const player = client.kazagumo.players.get(guild.id);
            
            if (!player) {
                return interaction.reply({ 
                    embeds: [errorEmbed('No active player found!')], 
                    ephemeral: true 
                });
            }
            
            // Check if user is in the same voice channel
            const member = interaction.member;
            if (!member.voice.channel || member.voice.channel.id !== player.voiceId) {
                return interaction.reply({ 
                    embeds: [errorEmbed('You must be in the same voice channel to use these controls!')], 
                    ephemeral: true 
                });
            }
            
            try {
                switch (interaction.customId) {
                    case 'pause_resume':
                        if (player.paused) {
                            player.pause(false);
                            await interaction.reply({ 
                                embeds: [successEmbed(`${config.emojis.play} Resumed playback`)],
                                ephemeral: true 
                            });
                        } else {
                            player.pause(true);
                            await interaction.reply({ 
                                embeds: [successEmbed(`${config.emojis.pause} Paused playback`)],
                                ephemeral: true 
                            });
                        }
                        break;
                        
                    case 'skip':
                        player.skip();
                        await interaction.reply({ 
                            embeds: [successEmbed(`${config.emojis.skip} Skipped to the next track`)],
                            ephemeral: true 
                        });
                        break;
                        
                    case 'stop':
                        player.destroy();
                        await interaction.reply({ 
                            embeds: [successEmbed(`${config.emojis.stop} Stopped playback and left the voice channel`)],
                            ephemeral: true 
                        });
                        break;
                        
                    case 'queue':
                        const queueCommand = client.commands.get('queue');
                        if (queueCommand) {
                            await queueCommand.execute(interaction);
                        } else {
                            await interaction.reply({ 
                                embeds: [errorEmbed('Queue command not found!')],
                                ephemeral: true 
                            });
                        }
                        break;
                        
                    default:
                        await interaction.reply({ 
                            embeds: [errorEmbed('Unknown button interaction')],
                            ephemeral: true 
                        });
                }
            } catch (error) {
                console.error('Error handling button interaction:', error);
                await interaction.reply({ 
                    embeds: [errorEmbed(`An error occurred: ${error.message || 'Unknown error'}`)],
                    ephemeral: true 
                });
            }
        }
    },
};
