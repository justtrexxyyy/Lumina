const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../utils/embeds');
const config = require('../config');

// Helper function to create volume bar for volume buttons
function createVolumeBar(volume) {
    const maxBars = 10;
    const filledBars = Math.round((volume / 100) * maxBars);
    const emptyBars = maxBars - filledBars;
    
    return '▓'.repeat(filledBars) + '░'.repeat(emptyBars);
}

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
                
                // Only handle the error if the interaction is still valid and hasn't timed out
                try {
                    const errorMessage = 'There was an error while executing this command!';
                    
                    // Try to reply depending on the current interaction state
                    if (interaction.replied) {
                        await interaction.followUp({ 
                            content: errorMessage,
                            ephemeral: true 
                        }).catch(e => console.error('Could not follow up with error:', e));
                    } else if (interaction.deferred) {
                        await interaction.editReply({ 
                            content: errorMessage,
                            ephemeral: true 
                        }).catch(e => console.error('Could not edit reply with error:', e));
                    } else {
                        await interaction.reply({ 
                            content: errorMessage,
                            ephemeral: true 
                        }).catch(e => console.error('Could not reply with error:', e));
                    }
                } catch (followUpError) {
                    console.error('Error sending error response:', followUpError);
                    // We can't do anything more if this fails
                }
            }
        }
        
        // Re-enabled button interactions in this file
        // since they're not fully implemented in index.js
        if (interaction.isButton()) {
            const { client, guild } = interaction;
            const player = client.kazagumo.players.get(guild.id);
            
            if (!player) {
                try {
                    await interaction.reply({ 
                        content: 'No active player found! Start playback with the /play command.',
                        ephemeral: true 
                    });
                } catch (error) {
                    console.error('Error replying to no player found:', error);
                }
                return;
            }
            
            // Check if user is in the same voice channel
            const member = interaction.member;
            if (!member.voice.channel || member.voice.channel.id !== player.voiceId) {
                try {
                    await interaction.reply({ 
                        content: 'You must be in the same voice channel to use these controls!',
                        ephemeral: true 
                    });
                } catch (error) {
                    console.error('Error replying to voice channel check:', error);
                }
                return;
            }
            
            try {
                switch (interaction.customId) {
                    case 'pauseresume':
                        try {
                            // Toggle between pause and resume
                            const isPaused = player.paused;
                            player.pause(!isPaused);
                            
                            await interaction.reply({ 
                                content: isPaused ? 'Resumed the playback!' : 'Paused the playback!',
                                ephemeral: true 
                            }).catch(error => {
                                console.error('Failed to send pause/resume response:', error);
                            });
                        } catch (error) {
                            console.error('Error in pause/resume button:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                    case 'replay':
                        try {
                            // Seek to position 0 (beginning of the track)
                            await player.seek(0);
                            await interaction.reply({ 
                                content: 'Replaying current track from the beginning!',
                                ephemeral: true 
                            }).catch(error => {
                                console.error('Failed to send replay response:', error);
                            });
                        } catch (error) {
                            console.error('Error in replay button:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                    // Keep these for backward compatibility with any old messages
                    case 'pause':
                        try {
                            player.pause(true);
                            await interaction.reply({ 
                                content: 'Paused the playback!',
                                ephemeral: true 
                            }).catch(error => {
                                console.error('Failed to send pause response:', error);
                            });
                        } catch (error) {
                            console.error('Error in pause button:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                    case 'resume':
                        try {
                            player.pause(false);
                            await interaction.reply({ 
                                content: 'Resumed the playback!',
                                ephemeral: true 
                            }).catch(error => {
                                console.error('Failed to send resume response:', error);
                            });
                        } catch (error) {
                            console.error('Error in resume button:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                    case 'skip':
                        try {
                            player.skip();
                            await interaction.reply({ 
                                content: 'Skipped to the next track!',
                                ephemeral: true 
                            }).catch(error => {
                                console.error('Failed to send skip response:', error);
                            });
                        } catch (error) {
                            console.error('Error in skip button:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                    case 'stop':
                        try {
                            // Don't delete the nowplaying message when using the button
                            // Only destroy the player
                            player.destroy();
                            await interaction.reply({ 
                                content: 'Stopped playback and cleared the queue!',
                                ephemeral: true 
                            }).catch(error => {
                                console.error('Failed to send stop response:', error);
                            });
                        } catch (error) {
                            console.error('Error in stop button:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                    case 'queue':
                        try {
                            // Instead of trying to reuse the queue command's implementation,
                            // let's implement simplified queue info directly
                            const queue = player.queue;
                            if (!queue || queue.length === 0) {
                                await interaction.reply({
                                    content: 'There are no tracks in the queue',
                                    ephemeral: true
                                }).catch(error => {
                                    console.error('Failed to send empty queue response:', error);
                                });
                                break;
                            }
                            
                            // Create a simplified queue display
                            let description = '';
                            // Get up to 5 tracks to show
                            const tracksToShow = Math.min(5, queue.length);
                            for (let i = 0; i < tracksToShow; i++) {
                                const track = queue[i];
                                description += `**${i+1}.** ${track.title}\n`;
                            }
                            
                            if (queue.length > tracksToShow) {
                                description += `\n... and ${queue.length - tracksToShow} more track(s)`;
                            }
                            
                            await interaction.reply({
                                content: `**Queue - ${queue.length} track(s)**\n\n${description}`,
                                ephemeral: true
                            }).catch(error => {
                                console.error('Failed to send queue response:', error);
                            });
                        } catch (error) {
                            console.error('Error handling queue button:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                    case 'loop':
                        try {
                            // Handle loop mode cycling: none > track > queue > none
                            // Kazagumo uses 'none', 'track', 'queue' as valid loop modes
                            const loopModes = ['none', 'track', 'queue'];
                            const currentMode = player.loop || 'none';
                            const currentIndex = loopModes.indexOf(currentMode);
                            const nextIndex = (currentIndex + 1) % loopModes.length;
                            const nextMode = loopModes[nextIndex];
                            
                            player.setLoop(nextMode);
                            
                            // Friendly mode names for the message
                            const modeNames = {
                                'none': 'disabled',
                                'track': 'current track',
                                'queue': 'entire queue'
                            };
                            
                            await interaction.reply({ 
                                content: `Loop mode set to: ${modeNames[nextMode]}`,
                                ephemeral: true 
                            }).catch(error => {
                                console.error('Failed to send loop response:', error);
                            });
                        } catch (error) {
                            console.error('Error in loop button:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                    case 'shuffle':
                        try {
                            if (player.queue.length < 2) {
                                await interaction.reply({
                                    content: 'Need at least 2 tracks in the queue to shuffle!',
                                    ephemeral: true
                                }).catch(error => {
                                    console.error('Failed to send insufficient tracks message:', error);
                                });
                            } else {
                                player.queue.shuffle();
                                await interaction.reply({ 
                                    content: 'Queue has been shuffled!',
                                    ephemeral: true 
                                }).catch(error => {
                                    console.error('Failed to send shuffle success message:', error);
                                });
                            }
                        } catch (error) {
                            console.error('Error in shuffle button:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                    case 'volume_down':
                        try {
                            const currentVolume = player.volume;
                            // Decrease by 10%, minimum volume is 0
                            const newVolume = Math.max(0, currentVolume - 10);
                            await player.setVolume(newVolume);
                            
                            // Create a volume bar
                            const volumeBar = createVolumeBar(newVolume);
                            
                            await interaction.reply({ 
                                content: `Volume set to ${newVolume}% ${volumeBar}`,
                                ephemeral: true 
                            }).catch(error => {
                                console.error('Failed to send volume_down response:', error);
                            });
                        } catch (error) {
                            console.error('Error in volume_down button:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                    case 'volume_up':
                        try {
                            const currentVolume = player.volume;
                            // Increase by 10%, maximum volume is 200
                            const newVolume = Math.min(200, currentVolume + 10);
                            await player.setVolume(newVolume);
                            
                            // Create a volume bar
                            const volumeBar = createVolumeBar(newVolume);
                            
                            await interaction.reply({ 
                                content: `Volume set to ${newVolume}% ${volumeBar}`,
                                ephemeral: true 
                            }).catch(error => {
                                console.error('Failed to send volume_up response:', error);
                            });
                        } catch (error) {
                            console.error('Error in volume_up button:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                        
                    case 'replay':
                        try {
                            // Get the current track
                            const currentTrack = player.queue.current;
                            if (!currentTrack) {
                                await interaction.reply({
                                    content: 'No track is currently playing!',
                                    ephemeral: true
                                }).catch(error => {
                                    console.error('Failed to send no track response:', error);
                                });
                                break;
                            }
                            
                            // Replay the current track by seeking to position 0
                            await player.seek(0);
                            
                            await interaction.reply({
                                content: `Replaying track: **${currentTrack.title}**`,
                                ephemeral: true
                            }).catch(error => {
                                console.error('Failed to send replay response:', error);
                            });
                        } catch (error) {
                            console.error('Error in replay button:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                    default:
                        try {
                            await interaction.reply({ 
                                content: 'Unknown button action',
                                ephemeral: true 
                            }).catch(error => {
                                console.error('Failed to send unknown button response:', error);
                            });
                        } catch (error) {
                            console.error('Error in default button case:', error);
                            // Don't attempt to reply if there's an error
                        }
                        break;
                        
                    // Handlers for queue ended buttons
                    case 'play_again':
                    case 'play':
                        try {
                            // Respond with a message directing the user to use the /play command
                            await interaction.reply({
                                content: 'Please use the `/play` command to search for and play music!',
                                ephemeral: true
                            });
                        } catch (error) {
                            console.error('Error in play_again button:', error);
                        }
                        break;
                        
                    case 'leave':
                        try {
                            // Check if there's still an active player
                            const player = client.kazagumo.players.get(guild.id);
                            if (player) {
                                player.destroy();
                                await interaction.reply({
                                    content: 'Left the voice channel and cleared the queue!',
                                    ephemeral: true
                                });
                            } else {
                                // No player, so just send a message
                                await interaction.reply({
                                    content: 'I\'m not currently in a voice channel.',
                                    ephemeral: true
                                });
                            }
                        } catch (error) {
                            console.error('Error in leave button:', error);
                        }
                        break;
                        
                    case '247toggle':
                        try {
                            // Toggle 24/7 mode
                            if (!client.twentyFourSeven) {
                                client.twentyFourSeven = new Set();
                            }
                            
                            const guildId = guild.id;
                            const has247 = client.twentyFourSeven.has(guildId);
                            
                            if (has247) {
                                client.twentyFourSeven.delete(guildId);
                                await interaction.reply({
                                    content: '24/7 mode disabled. I will leave the voice channel when the queue ends.',
                                    ephemeral: true
                                });
                            } else {
                                client.twentyFourSeven.add(guildId);
                                await interaction.reply({
                                    content: '24/7 mode enabled. I will stay in the voice channel even when the queue ends.',
                                    ephemeral: true
                                });
                            }
                        } catch (error) {
                            console.error('Error in 247toggle button:', error);
                        }
                        break;
                    
                    case 'help':
                        try {
                            // Send a simple help message with common commands
                            const helpEmbed = createEmbed({
                                title: 'Quick Help Guide',
                                description: 'Here are some common commands to get you started:',
                                fields: [
                                    {
                                        name: '🎵 Music Commands',
                                        value: '`/play` - Play a song or playlist\n`/search` - Search for songs\n`/queue` - View the current queue\n`/skip` - Skip to the next song\n`/volume` - Adjust the volume'
                                    },
                                    {
                                        name: '⚙️ Settings',
                                        value: '`/247` - Toggle 24/7 mode\n`/loop` - Set loop mode\n`/autoplay` - Toggle autoplay'
                                    }
                                ]
                            });
                            
                            await interaction.reply({
                                embeds: [helpEmbed],
                                ephemeral: true
                            });
                        } catch (error) {
                            console.error('Error in help button:', error);
                        }
                        break;
                }
            } catch (error) {
                // Just log the error and don't try to respond to the interaction
                // This avoids the most common issues with button interactions
                console.error('Error handling button interaction:', error);
                // We don't attempt to reply to the interaction here to avoid additional errors
            }
        }
    },
};
