const { ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionResponse } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../utils/embeds');
const config = require('../config');
const logger = require('../utils/logger');

// Helper function to create volume bar for volume buttons
function createVolumeBar(volume) {
    const maxBars = 10;
    const filledBars = Math.round((volume / 100) * maxBars);
    const emptyBars = maxBars - filledBars;
    
    return '▓'.repeat(filledBars) + '░'.repeat(emptyBars);
}

// Helper function to safely respond to interactions
async function safeReply(interaction, options) {
    try {
        // Use flags.ephemeral instead of ephemeral to avoid deprecation warnings
        if (options.ephemeral) {
            options.flags = { ephemeral: true };
            delete options.ephemeral;
        }
        
        // Only attempt to reply if the interaction hasn't been replied to
        if (interaction.replied || interaction.deferred) {
            return await interaction.followUp(options).catch(() => null);
        } else {
            return await interaction.reply(options).catch(() => null);
        }
    } catch (error) {
        // Silent error handling
        return null;
    }
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                // Silent handling for unknown commands
                return;
            }

            try {
                // Log command usage to webhook
                let commandArgs = '';
                if (interaction.options && interaction.options.data && interaction.options.data.length > 0) {
                    commandArgs = interaction.options.data.map(option => {
                        if (option.name === 'query' || option.name === 'song') {
                            return `${option.name}: "${option.value}"`;
                        }
                        return `${option.name}: ${option.value}`;
                    }).join(', ');
                }
                logger.command(interaction, interaction.commandName, commandArgs);
                
                // Execute the command
                await command.execute(interaction);
            } catch (error) {
                // Log the error to the webhook
                try {
                    logger.error(
                        `Command /${interaction.commandName}`, 
                        error,
                        [
                            { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                            { name: 'Guild', value: `${interaction.guild ? interaction.guild.name : 'DM'} (${interaction.guild ? interaction.guild.id : 'N/A'})`, inline: true }
                        ]
                    );
                } catch (logError) {
                    // Silent error handling for logger
                }
                
                // Only handle the error if the interaction is still valid and hasn't timed out
                try {
                    const errorMessage = 'There was an error while executing this command!';
                    
                    // Try to reply depending on the current interaction state
                    if (interaction.replied) {
                        await interaction.followUp({ 
                            content: errorMessage,
                            ephemeral: true 
                        }).catch(() => {});
                    } else if (interaction.deferred) {
                        await interaction.editReply({ 
                            content: errorMessage,
                            ephemeral: true 
                        }).catch(() => {});
                    } else {
                        await interaction.reply({ 
                            content: errorMessage,
                            ephemeral: true 
                        }).catch(() => {});
                    }
                } catch (followUpError) {
                    // Silent error handling - can't do anything more if this fails
                }
            }
        }
        
        // Re-enabled button interactions in this file
        // since they're not fully implemented in index.js
        if (interaction.isButton()) {
            // Log button interaction
            try {
                logger.command(interaction, `Button: ${interaction.customId}`, '');
            } catch (error) {
                // Silent error for logger
            }
            
            // Handle button interactions silently
            const { client, guild } = interaction;
            const player = client.kazagumo.players.get(guild.id);
            
            if (!player) {
                // Handle special case for buttons that don't need an active player
                if (interaction.customId === 'play' || interaction.customId === 'help' || interaction.customId === '247toggle' || interaction.customId === 'leave') {
                    // These buttons will be handled in their respective switch cases
                } else {
                    // Use safeReply for safer interaction handling
                    await safeReply(interaction, { 
                        content: 'No active player found! Start playback with the /play command.',
                        ephemeral: true
                    });
                    return;
                }
                return;
            }
            
            // Check if user is in the same voice channel
            const member = interaction.member;
            
            // Skip voice channel check for buttons that can be used from anywhere
            if (interaction.customId === 'help' || interaction.customId === 'play') {
                // These buttons don't require voice channel check
            } 
            // Check if player needs voice channel
            else if (player && (!member.voice.channel || member.voice.channel.id !== player.voiceId)) {
                await safeReply(interaction, { 
                    content: 'You must be in the same voice channel to use these controls!',
                    ephemeral: true
                });
                return;
            }
            
            try {
                switch (interaction.customId) {
                    case 'pauseresume':
                        try {
                            // Toggle between pause and resume
                            const isPaused = player.paused;
                            player.pause(!isPaused);
                            
                            // Use safeReply to handle the interaction safely
                            await safeReply(interaction, { 
                                content: isPaused ? 'Resumed the playback!' : 'Paused the playback!',
                                ephemeral: true 
                            });
                        } catch (error) {
                            // Silent error handling - no console logs
                        }
                        break;
                        
                    case 'replay':
                        try {
                            // Seek to position 0 (beginning of the track)
                            await player.seek(0);
                            await interaction.reply({ 
                                content: 'Replaying current track from the beginning!',
                                ephemeral: true 
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    // Combined pause/resume toggle button
                    case 'pauseresume':
                        try {
                            // Get the current paused state BEFORE changing it
                            const currentlyPaused = player.paused;
                            
                            // Get the nowplaying message information
                            const messageInfo = client.nowPlayingMessages.get(guild.id);
                            
                            // Toggle the pause state
                            if (currentlyPaused) {
                                // Was paused, so resume it
                                player.pause(false);
                                await interaction.reply({ 
                                    content: 'Resumed the playback!',
                                    ephemeral: true 
                                }).catch(() => {});
                            } else {
                                // Was playing, so pause it
                                player.pause(true);
                                await interaction.reply({ 
                                    content: 'Paused the playback!',
                                    ephemeral: true 
                                }).catch(() => {});
                            }
                            
                            // Update the button's label if we have a message
                            if (messageInfo) {
                                try {
                                    const messageChannel = client.channels.cache.get(messageInfo.channelId);
                                    if (messageChannel) {
                                        const message = await messageChannel.messages.fetch(messageInfo.messageId).catch(() => null);
                                        if (message && message.editable) {
                                            // Determine the new button label based on the NEW paused state
                                            // (the opposite of what it was before)
                                            const newLabel = currentlyPaused ? 'Pause' : 'Resume';
                                            
                                            // Create new action rows with updated button label
                                            const updatedRows = [];
                                            
                                            // Process each existing row in the message
                                            for (const row of message.components) {
                                                const newRow = new ActionRowBuilder();
                                                const newComponents = [];
                                                
                                                // Process each component in the row
                                                for (const component of row.components) {
                                                    if (component.type === 2) { // Button type
                                                        // Create a new button based on the existing one
                                                        const newButton = new ButtonBuilder()
                                                            .setCustomId(component.customId)
                                                            .setStyle(component.style);
                                                        
                                                        // If this is the pause/resume button, update its label
                                                        if (component.customId === 'pauseresume') {
                                                            newButton.setLabel(newLabel);
                                                        } else {
                                                            newButton.setLabel(component.label);
                                                        }
                                                        
                                                        newComponents.push(newButton);
                                                    } else if (component.type === 3) { // Select menu type
                                                        // Copy the select menu as is
                                                        const selectMenu = new StringSelectMenuBuilder()
                                                            .setCustomId(component.customId)
                                                            .setPlaceholder(component.placeholder)
                                                            .addOptions(component.options);
                                                        
                                                        newRow.addComponents(selectMenu);
                                                    }
                                                }
                                                
                                                // If we have buttons to add, add them to the row
                                                if (newComponents.length > 0) {
                                                    newRow.addComponents(newComponents);
                                                }
                                                
                                                // Add the row if it has components
                                                if (newRow.components && newRow.components.length > 0) {
                                                    updatedRows.push(newRow);
                                                }
                                            }
                                            
                                            // Edit the message with the updated rows
                                            if (updatedRows.length > 0) {
                                                await message.edit({ components: updatedRows }).catch(() => {});
                                            }
                                        }
                                    }
                                } catch (error) {
                                    // Log error but don't break functionality
                                    console.error("Error updating pause/resume button:", error.message);
                                }
                            }
                        } catch (error) {
                            // Silent error handling
                            console.error("Error in pauseresume button:", error);
                        }
                        break;
                    
                    // Keep these for backward compatibility with any old messages
                    case 'pause':
                        try {
                            player.pause(true);
                            await interaction.reply({ 
                                content: 'Paused the playback!',
                                ephemeral: true 
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    case 'resume':
                        try {
                            player.pause(false);
                            await interaction.reply({ 
                                content: 'Resumed the playback!',
                                ephemeral: true 
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    case 'skip':
                        try {
                            player.skip();
                            await interaction.reply({ 
                                content: 'Skipped to the next track!',
                                ephemeral: true 
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    case 'stop':
                        try {
                            // Get the message ID before destroying the player
                            const messageInfo = client.nowPlayingMessages.get(guild.id);
                            
                            // Make sure the user is in a voice channel and it's the same as the bot's
                            const member = interaction.member;
                            const userVoiceChannel = member.voice.channel;
                            
                            if (!userVoiceChannel) {
                                await interaction.reply({ 
                                    content: 'You need to be in a voice channel to stop the music!',
                                    ephemeral: true 
                                }).catch(() => {});
                                return;
                            }
                            
                            if (userVoiceChannel.id !== player.voiceId) {
                                await interaction.reply({ 
                                    content: 'You need to be in the same voice channel as the bot to stop the music!',
                                    ephemeral: true 
                                }).catch(() => {});
                                return;
                            }
                            
                            // Destroy the player
                            player.destroy();
                            
                            // Remove components from the now playing message
                            if (messageInfo) {
                                try {
                                    const messageChannel = client.channels.cache.get(messageInfo.channelId);
                                    if (messageChannel) {
                                        const message = await messageChannel.messages.fetch(messageInfo.messageId).catch(() => null);
                                        if (message && message.editable) {
                                            // Remove all components (buttons)
                                            await message.edit({ components: [] }).catch(() => {});
                                        }
                                    }
                                } catch (e) {
                                    // Silent error handling
                                    console.error("Error removing buttons on stop:", e.message);
                                }
                            }
                            
                            // Send success message
                            await interaction.reply({ 
                                content: 'Stopped playback and cleared the queue!',
                                ephemeral: true 
                            }).catch(() => {});
                        } catch (error) {
                            // Log error but don't break functionality
                            console.error("Error in stop button:", error.message);
                            
                            // Try to send a friendly error message
                            try {
                                await interaction.reply({ 
                                    content: 'Failed to stop playback. Please try again or use the /stop command.',
                                    ephemeral: true 
                                }).catch(() => {});
                            } catch (replyError) {
                                // Silent catch
                            }
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
                                }).catch(() => {});
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
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
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
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    case 'shuffle':
                        try {
                            // Always shuffle regardless of queue length
                            player.queue.shuffle();
                            
                            if (player.queue.length === 0) {
                                await interaction.reply({
                                    content: 'Current track shuffled!',
                                    ephemeral: true
                                }).catch(() => {});
                            } else {
                                await interaction.reply({ 
                                    content: 'Queue has been shuffled!',
                                    ephemeral: true 
                                }).catch(() => {});
                            }
                        } catch (error) {
                            // Silent error handling
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
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
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
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
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
                                }).catch(() => {});
                                break;
                            }
                            
                            // Replay the current track by seeking to position 0
                            await player.seek(0);
                            
                            await interaction.reply({
                                content: `Replaying track: **${currentTrack.title}**`,
                                ephemeral: true
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    default:
                        try {
                            await interaction.reply({ 
                                content: 'Unknown button action',
                                ephemeral: true 
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
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
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
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
                                }).catch(() => {});
                            } else {
                                // No player, so just send a message
                                await interaction.reply({
                                    content: 'I am not in a voice channel!',
                                    ephemeral: true
                                }).catch(() => {});
                            }
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    case '247toggle':
                        try {
                            if (!member.voice.channel) {
                                await interaction.reply({
                                    content: 'You must be in a voice channel to toggle 24/7 mode!',
                                    ephemeral: true
                                }).catch(() => {});
                                break;
                            }
                            
                            // Toggle 24/7 mode
                            if (client.twentyFourSeven.has(guild.id)) {
                                client.twentyFourSeven.delete(guild.id);
                                await interaction.reply({
                                    content: '24/7 mode has been disabled. I will disconnect after inactivity.',
                                    ephemeral: true
                                }).catch(() => {});
                            } else {
                                client.twentyFourSeven.set(guild.id, member.voice.channel.id);
                                await interaction.reply({
                                    content: '24/7 mode has been enabled. I will stay in the voice channel indefinitely.',
                                    ephemeral: true
                                }).catch(() => {});
                            }
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                        
                    case 'help':
                        try {
                            const helpText = `**Bot Help**
Here are the main commands you can use:

• \`/play\` - Play a song by name or URL
• \`/queue\` - View the current queue
• \`/skip\` - Skip the current track
• \`/stop\` - Stop playback and clear queue
• \`/247\` - Toggle 24/7 mode
• \`/help\` - Show detailed help`;

                            await interaction.reply({
                                content: helpText,
                                ephemeral: true
                            }).catch(() => {});
                        } catch (error) {
                            // Silent error handling
                        }
                        break;
                }
            } catch (error) {
                // Silent error handling for the entire button section
            }
        } else if (interaction.isStringSelectMenu()) {
            // Log select menu interaction
            try {
                const selectedValues = interaction.values.join(', ');
                logger.command(interaction, `Select Menu: ${interaction.customId}`, `Selected: ${selectedValues}`);
            } catch (error) {
                // Silent error for logger
            }

            // Handle filter select menu (legacy support)
            if (interaction.customId === 'filter_select') {
                const selectedFilter = interaction.values[0];
                const guild = interaction.guild;
                const member = interaction.member;

                // Get the player instance for this server
                const player = interaction.client.kazagumo.players.get(guild.id);

                if (!player) {
                    return interaction.reply({ 
                        content: 'There is no active player in this server!', 
                        ephemeral: true 
                    }).catch(() => {});
                }

                // Check if user is in the same voice channel
                if (!member.voice.channel || member.voice.channel.id !== player.voiceId) {
                    return interaction.reply({ 
                        content: 'You must be in the same voice channel as the bot to use this!', 
                        ephemeral: true 
                    }).catch(() => {});
                }

                try {
                    // Import filter utilities
                    const { applyFilter, clearFilters, getFilterDisplayName } = require('../utils/filters');

                    // Handle 'none' selection (clear filters)
                    if (selectedFilter === 'none') {
                        await clearFilters(player);
                        await interaction.reply({
                            content: 'All filters have been cleared!',
                            ephemeral: true
                        }).catch(() => {});
                    } else {
                        // Apply the selected filter
                        const success = await applyFilter(player, selectedFilter);

                        if (success) {
                            await interaction.reply({
                                content: `Applied the ${getFilterDisplayName(selectedFilter)} filter!`,
                                ephemeral: true
                            }).catch(() => {});
                        } else {
                            await interaction.reply({
                                content: `Failed to apply the filter. Please try again.`,
                                ephemeral: true
                            }).catch(() => {});
                        }
                    }
                } catch (error) {
                    // Silent error handling
                    await interaction.reply({
                        content: 'An error occurred while applying the filter. Please try again.',
                        ephemeral: true
                    }).catch(() => {});
                }
            }
        }
    }
};