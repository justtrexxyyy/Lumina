require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Shoukaku, Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');
const config = require('./config');
const { formatDuration } = require('./utils/formatters');
const { createEmbed } = require('./utils/embeds');

// Create client instance with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// Store commands in a collection
client.commands = new Collection();
client.twentyFourSeven = new Collection();
client.autoplay = new Set();
client.nowPlayingMessages = new Map(); // Map to store Now Playing messages (guildId -> messageId)

// Initialize Shoukaku and Kazagumo
const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), config.lavalink.nodes, {
    moveOnDisconnect: false,
    resume: true,
    resumeTimeout: 30,
    reconnectTries: 2,
    restTimeout: 10000
});

client.kazagumo = new Kazagumo({
    defaultSearchEngine: 'youtube',
    send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    },
    plugins: [
        new Plugins.PlayerMoved(client)
    ]
}, new Connectors.DiscordJS(client), config.lavalink.nodes);

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Shoukaku events
shoukaku.on('ready', (name) => console.log(`Lavalink ${name}: Ready!`));
shoukaku.on('close', (name, code, reason) => console.warn(`Lavalink ${name}: Closed, Code ${code}, Reason ${reason || 'No reason'}`));
shoukaku.on('debug', (name, info) => console.debug(`Lavalink ${name}: Debug,`, info));
shoukaku.on('disconnect', (name, players, moved) => {
    if (moved) return;
    players.map(player => player.connection.disconnect());
    console.warn(`Lavalink ${name}: Disconnected`);
});
shoukaku.on('error', (name, error) => {
    console.error(`Lavalink ${name}: Error Caught,`, error);
    // Attempt to reconnect or handle the error
    if (error && error.message && (
        error.message.includes('Connection reset') || 
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('connection') ||
        error.message.includes('Transport failed')
    )) {
        console.log(`Lavalink ${name}: Connection issue detected, attempting to reconnect in 10 seconds...`);
        setTimeout(() => {
            try {
                console.log(`Lavalink ${name}: Attempting reconnection...`);
                shoukaku.reconnect();
            } catch (reconnectErr) {
                console.error(`Lavalink ${name}: Reconnection failed:`, reconnectErr);
            }
        }, 10000);
    }
});
shoukaku.on('close', (name, code, reason) => {
    console.warn(`Lavalink ${name}: Closed, Code ${code}, Reason ${reason || 'No reason'}`);
    // Attempt to reconnect for specific close codes
    if (code === 1000 || code >= 4000) {
        console.log(`Lavalink ${name}: Non-error close code, no action needed.`);
    } else {
        console.log(`Lavalink ${name}: Unexpected close code, attempting to reconnect in 5 seconds...`);
        setTimeout(() => {
            try {
                shoukaku.reconnect();
            } catch (reconnectErr) {
                console.error(`Lavalink ${name}: Reconnection failed:`, reconnectErr);
            }
        }, 5000);
    }
});
shoukaku.on('disconnect', (name, reason) => {
    console.warn(`Lavalink ${name}: Disconnected, Reason ${reason || 'No reason'}`);
    // Attempt to reconnect on disconnect
    console.log(`Lavalink ${name}: Attempting reconnection in 5 seconds...`);
    setTimeout(() => {
        try {
            shoukaku.reconnect();
        } catch (reconnectErr) {
            console.error(`Lavalink ${name}: Reconnection failed:`, reconnectErr);
        }
    }, 5000);
});

// Kazagumo events
client.kazagumo.on('playerStart', async (player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
        try {
            console.log('Track started playing:', track.title);
            
            // Create standard embed
            const embed = createEmbed({
                title: `Now Playing`,
                thumbnail: track.thumbnail || config.botLogo,
                fields: [
                    {
                        name: 'Track',
                        value: `[${track.title}](${config.supportServer})`,
                        inline: false
                    },
                    {
                        name: 'Artist',
                        value: track.author || 'Unknown',
                        inline: true
                    },
                    {
                        name: 'Requested By',
                        value: `<@${track.requester.id}>`,
                        inline: true
                    },
                    {
                        name: 'Duration',
                        value: track.isStream ? 'LIVE' : formatDuration(track.length),
                        inline: true
                    }
                ]
            });
            
            // Add buttons and filter select menu for now playing message
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
            
            const nowPlayingRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pause')
                        .setLabel('Pause/Resume')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('skip')
                        .setLabel('Skip')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('queue')
                        .setLabel('Queue')
                        .setStyle(ButtonStyle.Success)
                );
            
            const controlsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('shuffle')
                        .setLabel('Shuffle')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('loop')
                        .setLabel('Loop')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('stop')
                        .setLabel('Stop')
                        .setStyle(ButtonStyle.Danger)
                );
                
            // Get filters from utils/filters.js
            const { getAvailableFilters, getFilterDisplayName } = require('./utils/filters');
            
            // Create a dropdown menu for filters
            const filtersSelectMenu = new StringSelectMenuBuilder()
                .setCustomId('filter_select')
                .setPlaceholder('Select a filter')
                .addOptions([
                    {
                        label: 'No Filter',
                        description: 'Remove all filters',
                        value: 'none'
                    },
                    {
                        label: 'Bass Boost',
                        description: 'Enhance the bass frequencies',
                        value: 'bassboost'
                    },
                    {
                        label: '8D Audio',
                        description: 'Creates a spatial rotation effect',
                        value: '8d'
                    },
                    {
                        label: 'Nightcore',
                        description: 'Faster with tremolo effect',
                        value: 'nightcore'
                    },
                    {
                        label: 'Vaporwave',
                        description: 'Slowed down with reverb-like effect',
                        value: 'vaporwave'
                    },
                    {
                        label: 'Karaoke',
                        description: 'Reduces vocals for karaoke',
                        value: 'karaoke'
                    },
                    {
                        label: 'Low Pass',
                        description: 'Reduces high frequencies',
                        value: 'lowpass'
                    },
                    {
                        label: 'Slow Mode',
                        description: 'Slows down the playback',
                        value: 'slowmode'
                    }
                ]);
            
            // Create filter dropdown row
            const filtersDropdownRow = new ActionRowBuilder()
                .addComponents(filtersSelectMenu);
            
            // No more filter buttons - removed as requested
            
            // Send the embed with controls and filter dropdown (dropdown is now above control buttons)
            const message = await channel.send({ 
                embeds: [embed],
                components: [filtersDropdownRow, nowPlayingRow, controlsRow]
            });
            
            // Store the message ID in the map
            client.nowPlayingMessages.set(player.guildId, { 
                channelId: channel.id, 
                messageId: message.id 
            });
            
        } catch (error) {
            console.error('Error sending now playing message:', error);
            
            // Simple fallback embed
            const embed = createEmbed({
                title: `Now Playing`,
                description: `[${track.title}](${config.supportServer})`,
                footer: 'Error occurred while creating the full embed'
            });
            
            // Add basic buttons
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            
            const controlsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pause')
                        .setLabel('Pause/Resume')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('skip')
                        .setLabel('Skip')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('stop')
                        .setLabel('Stop')
                        .setStyle(ButtonStyle.Danger)
                );
            
            // Create a simplified dropdown for fallback
            const { StringSelectMenuBuilder } = require('discord.js');
            
            const fallbackFilterMenu = new StringSelectMenuBuilder()
                .setCustomId('filter_select')
                .setPlaceholder('Select a filter')
                .addOptions([
                    {
                        label: 'No Filter',
                        description: 'Remove all filters',
                        value: 'none'
                    },
                    {
                        label: 'Bass Boost',
                        description: 'Enhance the bass frequencies',
                        value: 'bassboost'
                    },
                    {
                        label: 'Nightcore',
                        description: 'Faster with tremolo effect',
                        value: 'nightcore'
                    },
                    {
                        label: 'Vaporwave',
                        description: 'Slowed down effect',
                        value: 'vaporwave'
                    }
                ]);
                
            const fallbackFilterRow = new ActionRowBuilder()
                .addComponents(fallbackFilterMenu);
                
            channel.send({ 
                embeds: [embed],
                components: [fallbackFilterRow, controlsRow]
            }).then(message => {
                // Store the message ID in the map
                client.nowPlayingMessages.set(player.guildId, { 
                    channelId: channel.id, 
                    messageId: message.id 
                });
            }).catch(console.error);
        }
    }
});

client.kazagumo.on('playerEmpty', async (player) => {
    const channel = client.channels.cache.get(player.textId);
    const guildId = player.guildId;
    
    console.log(`Player empty for guild ${guildId}`);
    
    // No longer deleting the "Now Playing" message when player is empty
    // This allows users to see what was playing even after it's stopped
    // The message will be replaced when a new track starts playing
    
    // Initialize autoplay set if it doesn't exist
    if (!client.autoplay) {
        console.log(`Creating autoplay Set in playerEmpty event`);
        client.autoplay = new Set();
    }
    
    // Check if autoplay is enabled for this guild
    console.log(`Checking autoplay status for guild ${guildId}: ${client.autoplay.has(guildId) ? 'Enabled' : 'Disabled'}`);
    
    if (client.autoplay.has(guildId)) {
        console.log(`Autoplay is enabled for guild ${guildId}, attempting to find related tracks`);
        
        try {
            // Get the last played track to find related tracks
            let lastTrack;
            
            // Try to get the previous track from player.queue
            if (player.queue && player.queue.previous) {
                lastTrack = player.queue.previous;
                console.log(`Found previous track in queue: ${lastTrack.title}`);
            } else {
                // If no previous track, check player.current or try with a default search
                console.log(`No previous track found in queue, checking alternatives`);
                
                if (player.current) {
                    lastTrack = player.current;
                    console.log(`Using current track as reference: ${lastTrack.title}`);
                } else {
                    // If no track info available, inform the user and exit
                    console.log(`No track information available for autoplay`);
                    if (channel) {
                        channel.send({ content: `**Autoplay**: Cannot find any track information to use as reference.` }).catch(console.error);
                    }
                    return;
                }
            }
            
            // Send a message that we're searching for similar tracks
            if (channel) {
                channel.send({ content: `**Autoplay**: Searching for similar tracks...` }).catch(console.error);
            }
            
            // Log track details for debugging
            console.log(`Autoplay: Reference track details:`, {
                title: lastTrack.title || 'Unknown',
                uri: lastTrack.uri || 'No URI',
                author: lastTrack.author || 'Unknown'
            });
            
            // Determine search query - prefer URI, fall back to title+author
            let searchQuery;
            let searchMethod;
            
            if (lastTrack.uri) {
                searchQuery = lastTrack.uri;
                searchMethod = 'URI';
            } else {
                searchQuery = `${lastTrack.author ? lastTrack.author + ' - ' : ''}${lastTrack.title}`;
                searchMethod = 'title/artist';
            }
            
            console.log(`Autoplay: Searching by ${searchMethod}: "${searchQuery}"`);
            
            // Search for related tracks
            const result = await client.kazagumo.search(searchQuery, { 
                requester: lastTrack.requester || { id: client.user.id, username: client.user.username } 
            }).catch(e => {
                console.log(`Autoplay: Error searching: ${e.message}`);
                return null;
            });
            
            if (result && result.tracks && result.tracks.length > 0) {
                console.log(`Autoplay: Found ${result.tracks.length} tracks for search query`);
                
                // Filter out the track that just played if possible
                let filteredTracks = result.tracks;
                
                if (lastTrack.uri || lastTrack.title) {
                    filteredTracks = result.tracks.filter(track => {
                        // Compare by URI if available, otherwise by title
                        if (lastTrack.uri && track.uri) {
                            return track.uri !== lastTrack.uri;
                        } else if (lastTrack.title && track.title) {
                            return track.title !== lastTrack.title;
                        }
                        return true; // Keep if we can't compare
                    });
                    
                    console.log(`Autoplay: After filtering out reference track, ${filteredTracks.length} tracks remain`);
                }
                
                if (filteredTracks.length > 0) {
                    // Randomly select one of the tracks, with proper error checking
                    const randomIndex = Math.floor(Math.random() * filteredTracks.length);
                    const randomTrack = filteredTracks[randomIndex];
                    
                    // Verify the random track has the necessary properties
                    if (!randomTrack || typeof randomTrack !== 'object') {
                        console.error(`Autoplay: Selected track at index ${randomIndex} is undefined or not an object`);
                        if (channel) {
                            channel.send({ content: `**Autoplay Error**: Invalid track data returned from search.` }).catch(console.error);
                        }
                        return;
                    }
                    
                    console.log(`Autoplay: Selected track ${randomIndex+1}/${filteredTracks.length}: ${randomTrack.title || 'Unknown Title'}`);
                    
                    try {
                        // Verify the track has required properties before adding to queue
                        if (!randomTrack.title) {
                            console.warn(`Autoplay: Track is missing title property, adding with placeholder title`);
                            randomTrack.title = "Unknown Track";
                        }
                        
                        // Add the track to the queue
                        player.queue.add(randomTrack);
                        console.log(`Autoplay: Added track to queue`);
                        
                        // Play it (since the queue was empty)
                        if (!player.playing && !player.paused) {
                            console.log(`Autoplay: Starting playback of the new track`);
                            try {
                                await player.play();
                            } catch (e) {
                                console.error(`Autoplay: Error starting playback: ${e.message}`);
                                if (channel) {
                                    channel.send({ content: `**Autoplay Error**: Failed to play the next track: ${e.message}` }).catch(console.error);
                                }
                            }
                        }
                        
                        // Send a message about the added track
                        if (channel) {
                            channel.send({ content: `**Autoplay**: Added **${randomTrack.title}** to the queue.` }).catch(console.error);
                        }
                        
                        // Don't proceed with the disconnect logic since we have autoplay
                        return;
                    } catch (playError) {
                        console.error(`Autoplay: Error in queue/play handling: ${playError.message}`);
                        if (channel) {
                            channel.send({ content: `**Autoplay Error**: ${playError.message}` }).catch(console.error);
                        }
                    }
                } else {
                    console.log(`Autoplay: No suitable tracks found after filtering`);
                    if (channel) {
                        channel.send({ content: `**Autoplay**: Couldn't find any suitable related tracks to play.` }).catch(console.error);
                    }
                }
            } else {
                console.log(`Autoplay: No tracks found for query "${searchQuery}"`);
                if (channel) {
                    channel.send({ content: `**Autoplay**: Couldn't find any related tracks.` }).catch(console.error);
                }
            }
        } catch (error) {
            console.error('Autoplay Error:', error);
            if (channel) {
                channel.send({ content: `**Autoplay Error**: An unexpected error occurred.` }).catch(console.error);
            }
        }
    }
    
    // Don't disconnect if 24/7 mode is enabled
    if (client.twentyFourSeven.has(guildId)) return;
    
    if (channel) {
        // Create an enhanced queue ended embed with more information and styling
        const queueEndEmbed = createEmbed({
            title: 'Music Queue Ended',
            description: 'The music player has finished playing all tracks in the queue.',
            fields: [
                {
                    name: 'Session Stats',
                    value: `Total Tracks Played: ${player.queue.previous ? player.queue.previous.length : 0}`,
                    inline: true
                },
                {
                    name: 'Auto Disconnect',
                    value: 'The bot will automatically leave the voice channel in 1 minute unless new tracks are added.',
                    inline: false
                },
                {
                    name: 'Add More Music',
                    value: 'Use `/play` command to add more tracks to the queue.',
                    inline: true
                },
                {
                    name: '24/7 Mode',
                    value: 'Use `/247` command to keep the bot in the voice channel indefinitely.',
                    inline: true
                }
            ],
            thumbnail: config.botLogo || null,
            color: '#ED4245',
            footer: { text: `${client.user.username} • Advanced Music Bot` }
        });
        
        // Create action row with buttons for quick actions
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        
        const queueEndRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('help')
                    .setLabel('Help')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('play')
                    .setLabel('Play New Track')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('247toggle')
                    .setLabel('Toggle 24/7 Mode')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('leave')
                    .setLabel('Leave Now')
                    .setStyle(ButtonStyle.Danger)
            );
        
        channel.send({ 
            embeds: [queueEndEmbed],
            components: [queueEndRow]
        }).catch(console.error);
        
        // Set a timeout to destroy the player if no new songs are added
        setTimeout(() => {
            const currentPlayer = client.kazagumo.players.get(guildId);
            if (currentPlayer && currentPlayer.queue.isEmpty && !client.twentyFourSeven.has(guildId)) {
                currentPlayer.destroy();
                const leaveEmbed = createEmbed({
                    title: 'Channel Left',
                    description: 'Left voice channel due to inactivity.',
                    color: '#ED4245'
                });
                channel.send({ embeds: [leaveEmbed] }).catch(console.error);
            }
        }, 60000);
    }
});

client.kazagumo.on('playerException', (player, error) => {
    console.error('Player Exception:', error);
    const channel = client.channels.cache.get(player.textId);
    
    // Determine if we need to recover the player
    let needsRecovery = false;
    let errorMessage = `**An error occurred while playing**: ${error.message || 'Unknown error'}`;
    
    if (error.message) {
        if (error.message.includes('destroyed') || error.message.includes('not found')) {
            // Player was destroyed or not found
            errorMessage = `**Connection Error**: Music player was disconnected unexpectedly. Use a command to reconnect.`;
            needsRecovery = false; // Let the user reconnect manually
        } else if (error.message.includes('Track stuck') || error.message.includes('load failed')) {
            // Track playback issues
            errorMessage = `**Playback Error**: The current track failed to load or got stuck. Skipping to the next song...`;
            needsRecovery = true;
        } else if (error.message.includes('Connection') || error.message.includes('WebSocket')) {
            // Connection issues
            errorMessage = `**Connection Error**: Lost connection to the music server. Attempting to reconnect...`;
            needsRecovery = true;
        }
    }
    
    if (channel) {
        channel.send({ content: errorMessage }).catch(console.error);
    }
    
    // Try to recover the player if needed
    if (needsRecovery && player) {
        try {
            // Skip to next song if available, otherwise stop
            if (player.queue.length > 0) {
                console.log('Attempting to recover player by skipping to next track');
                player.skip().catch(e => {
                    console.error('Failed to skip to next track during recovery:', e);
                    // If skip fails, try to stop and destroy
                    player.destroy().catch(console.error);
                });
            } else {
                console.log('No tracks in queue to recover with, destroying player');
                player.destroy().catch(console.error);
            }
        } catch (recoveryError) {
            console.error('Failed to recover player after exception:', recoveryError);
        }
    }
});

client.kazagumo.on('playerError', (player, error) => {
    console.error('Player Error:', error);
    const channel = client.channels.cache.get(player.textId);
    
    // Build a more detailed error message
    let errorMessage = `**Player Error**: ${error.message || 'Unknown error'}`;
    
    if (error.message) {
        if (error.message.includes('No available nodes')) {
            errorMessage = `**Connection Error**: Cannot connect to the music server. Please try again later.`;
        } else if (error.message.includes('Failed to decode')) {
            errorMessage = `**Playback Error**: This track cannot be played due to format issues. Please try another song.`;
        } else if (error.message.includes('Track information not available')) {
            errorMessage = `**Track Error**: Could not retrieve track information. The source may be unavailable.`;
        }
    }
    
    if (channel) {
        channel.send({ content: errorMessage }).catch(console.error);
    }
    
    // Attempt to reconnect if needed
    if (error.message && 
        (error.message.includes('No available nodes') || 
         error.message.includes('Connection') || 
         error.message.includes('WebSocket'))) {
        
        console.log('Connection-related player error, attempting to reconnect in 5 seconds...');
        
        setTimeout(() => {
            try {
                // Check if Lavalink nodes are available
                const nodesAvailable = shoukaku.nodes.filter(node => node.state === 1);
                
                if (nodesAvailable.length > 0) {
                    console.log('Lavalink nodes available, attempting to reconnect player');
                    const guildId = player.guildId;
                    const voiceId = player.voiceId;
                    const textId = player.textId;
                    
                    // Destroy current player
                    player.destroy().catch(console.error);
                    
                    // Create a new player after a short delay
                    setTimeout(() => {
                        if (voiceId && guildId) {
                            try {
                                client.kazagumo.createPlayer({
                                    guildId: guildId,
                                    voiceId: voiceId,
                                    textId: textId,
                                    deaf: true
                                });
                                
                                if (channel) {
                                    channel.send({ content: `Successfully reconnected to the voice channel.` }).catch(console.error);
                                }
                            } catch (e) {
                                console.error('Failed to create new player after error:', e);
                            }
                        }
                    }, 2000);
                } else {
                    console.log('No Lavalink nodes available for reconnection');
                }
            } catch (reconnectError) {
                console.error('Error during player reconnection attempt:', reconnectError);
            }
        }, 5000);
    }
});

// Login to Discord
// Add interactionCreate handler for buttons and filter buttons
client.on('interactionCreate', async (interaction) => {
    // Handle various button interactions
    if (interaction.isButton()) {
        // Handle queue end buttons
        if (interaction.customId === 'help') {
            const helpEmbed = createEmbed({
                title: 'Bot Help',
                description: 'Here are the main commands you can use:',
                fields: [
                    {
                        name: '/play',
                        value: 'Play a song from YouTube, Spotify, or other sources',
                        inline: true
                    },
                    {
                        name: '/queue',
                        value: 'View the current queue',
                        inline: true
                    },
                    {
                        name: '/skip',
                        value: 'Skip the current track',
                        inline: true
                    },
                    {
                        name: '/stop',
                        value: 'Stop playback and clear queue',
                        inline: true
                    },
                    {
                        name: '/247',
                        value: 'Toggle 24/7 mode',
                        inline: true
                    },
                    {
                        name: '/help',
                        value: 'Show detailed help',
                        inline: true
                    }
                ]
            });
            return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
        }
        
        if (interaction.customId === 'play') {
            return interaction.reply({ 
                content: 'Please use the `/play` command followed by a song name or URL to add a track to the queue.', 
                ephemeral: true 
            });
        }
        
        if (interaction.customId === '247toggle') {
            const guild = interaction.guild;
            const member = interaction.member;
            
            if (!member.voice.channel) {
                return interaction.reply({ 
                    content: 'You must be in a voice channel to toggle 24/7 mode!', 
                    ephemeral: true 
                });
            }
            
            // Toggle 24/7 mode
            if (client.twentyFourSeven.has(guild.id)) {
                client.twentyFourSeven.delete(guild.id);
                return interaction.reply({ 
                    content: '24/7 mode has been disabled. I will disconnect after inactivity.', 
                    ephemeral: true 
                });
            } else {
                client.twentyFourSeven.set(guild.id, member.voice.channel.id);
                return interaction.reply({ 
                    content: '24/7 mode has been enabled. I will stay in the voice channel indefinitely.', 
                    ephemeral: true 
                });
            }
        }
        
        if (interaction.customId === 'leave') {
            const guild = interaction.guild;
            const player = client.kazagumo.players.get(guild.id);
            
            if (!player) {
                return interaction.reply({ 
                    content: 'I am not in a voice channel!', 
                    ephemeral: true 
                });
            }
            
            // Force the player to disconnect
            player.destroy();
            return interaction.reply({ 
                content: 'Left the voice channel.', 
                ephemeral: true 
            });
        }
        
        // Handle media control buttons
        if (['pause', 'skip', 'stop', 'queue', 'shuffle', 'loop'].includes(interaction.customId)) {
            const guild = interaction.guild;
            const member = interaction.member;
            const player = client.kazagumo.players.get(guild.id);
            
            // Check if player exists
            if (!player) {
                return interaction.reply({ 
                    content: 'There is no active player in this server!', 
                    ephemeral: true 
                });
            }
            
            // Check if user is in the same voice channel
            if (!member.voice.channel || member.voice.channel.id !== player.voiceId) {
                return interaction.reply({ 
                    content: 'You must be in the same voice channel as the bot to use this!', 
                    ephemeral: true 
                });
            }
            
            try {
                switch (interaction.customId) {
                    case 'pause':
                        // Toggle pause state
                        player.pause(!player.paused);
                        return interaction.reply({ 
                            content: player.paused ? 'Paused the playback!' : 'Resumed the playback!', 
                            ephemeral: true 
                        });
                        
                    case 'skip':
                        // Skip current track
                        if (player.queue.length === 0 && !player.queue.current) {
                            return interaction.reply({ 
                                content: 'There is nothing to skip!', 
                                ephemeral: true 
                            });
                        }
                        player.skip();
                        return interaction.reply({ 
                            content: 'Skipped to the next track!', 
                            ephemeral: true 
                        });
                        
                    case 'stop':
                        // Stop playback and clear queue
                        player.queue.clear();
                        player.skip();
                        return interaction.reply({ 
                            content: 'Stopped the playback and cleared the queue!', 
                            ephemeral: true 
                        });
                        
                    case 'queue':
                        // Show queue - find the queue command and execute it
                        const queueCommand = client.commands.get('queue');
                        if (queueCommand) {
                            await queueCommand.execute(interaction);
                        } else {
                            return interaction.reply({ 
                                content: 'Queue command not found! Please use /queue instead.', 
                                ephemeral: true 
                            });
                        }
                        break;
                        
                    case 'shuffle':
                        // Shuffle the queue
                        if (player.queue.length < 2) {
                            return interaction.reply({ 
                                content: 'Need at least 2 tracks in the queue to shuffle!', 
                                ephemeral: true 
                            });
                        }
                        player.queue.shuffle();
                        return interaction.reply({ 
                            content: 'Shuffled the queue!', 
                            ephemeral: true 
                        });
                        
                    case 'loop':
                        // Toggle loop mode
                        const modes = ['none', 'track', 'queue'];
                        const currentIndex = modes.indexOf(player.loop);
                        const nextIndex = (currentIndex + 1) % modes.length;
                        player.setLoop(modes[nextIndex]);
                        
                        const modeMessages = {
                            'none': 'Loop mode disabled!',
                            'track': 'Now looping the current track!',
                            'queue': 'Now looping the entire queue!'
                        };
                        
                        return interaction.reply({ 
                            content: modeMessages[modes[nextIndex]], 
                            ephemeral: true 
                        });
                }
            } catch (error) {
                console.error('Error handling media control button:', error);
                return interaction.reply({ 
                    content: 'An error occurred while processing your request.', 
                    ephemeral: true 
                });
            }
        }
        
        // Handle filter button interactions
        if (interaction.customId.startsWith('filter_')) {
            const filterName = interaction.customId.replace('filter_', '');
            const guild = interaction.guild;
            const member = interaction.member;
            
            // Get the player instance for this server
            const player = client.kazagumo.players.get(guild.id);
            
            if (!player) {
                return interaction.reply({ 
                    content: 'There is no active player in this server!', 
                    ephemeral: true 
                });
            }
            
            // Check if user is in the same voice channel
            if (!member.voice.channel || member.voice.channel.id !== player.voiceId) {
                return interaction.reply({ 
                    content: 'You must be in the same voice channel as the bot to use this!', 
                    ephemeral: true 
                });
            }
            
            try {
                // Import filter utilities
                const { applyFilter, clearFilters, getFilterDisplayName } = require('./utils/filters');
                
                // Handle 'none' selection (clear filters)
                if (filterName === 'none') {
                    await clearFilters(player);
                    await interaction.reply({
                        content: 'All filters have been cleared!',
                        ephemeral: true
                    });
                } else {
                    // Apply the selected filter
                    const success = await applyFilter(player, filterName);
                    
                    if (success) {
                        await interaction.reply({
                            content: `Applied the ${getFilterDisplayName(filterName)} filter!`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: `Failed to apply the filter. Please try again.`,
                            ephemeral: true
                        });
                    }
                }
            } catch (error) {
                console.error('Error applying filter:', error);
                await interaction.reply({
                    content: 'An error occurred while applying the filter.',
                    ephemeral: true
                });
            }
            return;
        }
    } else {
        // Only handle StringSelectMenu interactions if not a button
        if (!interaction.isStringSelectMenu()) return;
        
        // Handle filter select menu (legacy support)
        if (interaction.customId === 'filter_select') {
            const selectedFilter = interaction.values[0];
            const guild = interaction.guild;
            const member = interaction.member;
            
            // Get the player instance for this server
            const player = client.kazagumo.players.get(guild.id);
            
            if (!player) {
                return interaction.reply({ 
                    content: 'There is no active player in this server!', 
                    ephemeral: true 
                });
            }
            
            // Check if user is in the same voice channel
            if (!member.voice.channel || member.voice.channel.id !== player.voiceId) {
                return interaction.reply({ 
                    content: 'You must be in the same voice channel as the bot to use this!', 
                    ephemeral: true 
                });
            }
            
            try {
                // Import filter utilities
                const { applyFilter, clearFilters, getFilterDisplayName } = require('./utils/filters');
                
                // Handle 'none' selection (clear filters)
                if (selectedFilter === 'none') {
                    await clearFilters(player);
                    await interaction.reply({
                        content: 'All filters have been cleared!',
                        ephemeral: true
                    });
                } else {
                    // Apply the selected filter
                    const success = await applyFilter(player, selectedFilter);
                    
                    if (success) {
                        await interaction.reply({
                            content: `Applied the ${getFilterDisplayName(selectedFilter)} filter!`,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: `Failed to apply the filter. Please try again.`,
                            ephemeral: true
                        });
                    }
                }
            } catch (error) {
                console.error('Error applying filter:', error);
                await interaction.reply({
                    content: 'An error occurred while applying the filter.',
                    ephemeral: true
                });
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
