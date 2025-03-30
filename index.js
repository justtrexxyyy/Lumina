require('dotenv').config();
const { Client, GatewayIntentBits, Collection, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Shoukaku, Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');
const config = require('./config');
const { createMusicCard } = require('./utils/imageCard');
const { formatDuration } = require('./utils/formatters');

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
            // Generate music card image
            console.log('Generating music card for:', track.title);
            
            // Determine the source platform
            let sourcePlatform = 'Unknown';
            if (track.uri) {
                if (track.uri.includes('youtube.com') || track.uri.includes('youtu.be')) {
                    sourcePlatform = 'YouTube';
                } else if (track.uri.includes('soundcloud.com')) {
                    sourcePlatform = 'SoundCloud';
                } else if (track.uri.includes('spotify.com')) {
                    sourcePlatform = 'Spotify';
                } else if (track.uri.includes('twitch.tv')) {
                    sourcePlatform = 'Twitch';
                }
            }
            
            // Create the music card image
            const musicCardPath = await createMusicCard(track, 0, player.volume, sourcePlatform, {
                requester: track.requester
            });
            
            // Create attachment from the generated image
            const attachment = new AttachmentBuilder(musicCardPath, { name: 'music_card.jpg' });
            
            // Create a simplified embed with just the image card
            const embed = {
                title: `${config.emojis.nowPlaying} Now Playing`,
                description: `${config.emojis.music} [${track.title}](${track.uri})`,
                image: {
                    url: 'attachment://music_card.jpg'
                },
                color: parseInt(config.embedColor.replace('#', ''), 16)
            };
            
            // Add buttons for now playing message
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            
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
            
            // Send message with music card image
            await channel.send({ 
                embeds: [embed],
                files: [attachment],
                components: [nowPlayingRow, controlsRow]
            });
            
            // Clean up the temporary file after sending
            fs.unlink(musicCardPath, (err) => {
                if (err) console.error('Error removing temporary music card file:', err);
            });
            
        } catch (error) {
            console.error('Error generating music card:', error);
            
            // Fallback to normal embed without the image card
            const artistInfo = track.author ? `\n${config.emojis.artist} Artist: **${track.author}**` : '';
            
            const embed = {
                title: `${config.emojis.nowPlaying} Now Playing`,
                description: `${config.emojis.music} [${track.title}](${track.uri})${artistInfo}`,
                fields: [
                    {
                        name: `${config.emojis.duration} Duration`,
                        value: track.isStream ? '🔴 LIVE' : formatDuration(track.length),
                        inline: true
                    },
                    {
                        name: `${config.emojis.user} Requested By`,
                        value: `<@${track.requester.id}>`,
                        inline: true
                    }
                ],
                thumbnail: {
                    url: track.thumbnail || config.botLogo
                },
                color: parseInt(config.embedColor.replace('#', ''), 16),
                footer: {
                    text: 'Music card image generation failed - using fallback embed'
                }
            };
            
            // Add buttons for now playing message (without emojis)
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            
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
            
            channel.send({ 
                embeds: [embed],
                components: [nowPlayingRow, controlsRow]
            }).catch(console.error);
        }
    }
});

client.kazagumo.on('playerEmpty', async (player) => {
    const channel = client.channels.cache.get(player.textId);
    const guildId = player.guildId;
    
    console.log(`Player empty for guild ${guildId}`);
    
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
                        channel.send({ content: `${config.emojis.warning} **Autoplay**: Cannot find any track information to use as reference.` }).catch(console.error);
                    }
                    return;
                }
            }
            
            // Send a message that we're searching for similar tracks
            if (channel) {
                channel.send({ content: `${config.emojis.autoplay} **Autoplay**: Searching for similar tracks...` }).catch(console.error);
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
                            channel.send({ content: `${config.emojis.warning} **Autoplay Error**: Invalid track data returned from search.` }).catch(console.error);
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
                                    channel.send({ content: `${config.emojis.warning} **Autoplay Error**: Failed to play the next track: ${e.message}` }).catch(console.error);
                                }
                            }
                        }
                        
                        // Send a message about the added track
                        if (channel) {
                            channel.send({ content: `${config.emojis.autoplay} **Autoplay**: Added **${randomTrack.title}** to the queue.` }).catch(console.error);
                        }
                        
                        // Don't proceed with the disconnect logic since we have autoplay
                        return;
                    } catch (playError) {
                        console.error(`Autoplay: Error in queue/play handling: ${playError.message}`);
                        if (channel) {
                            channel.send({ content: `${config.emojis.warning} **Autoplay Error**: ${playError.message}` }).catch(console.error);
                        }
                    }
                } else {
                    console.log(`Autoplay: No suitable tracks found after filtering`);
                    if (channel) {
                        channel.send({ content: `${config.emojis.warning} **Autoplay**: Couldn't find any suitable related tracks to play.` }).catch(console.error);
                    }
                }
            } else {
                console.log(`Autoplay: No tracks found for query "${searchQuery}"`);
                if (channel) {
                    channel.send({ content: `${config.emojis.warning} **Autoplay**: Couldn't find any related tracks.` }).catch(console.error);
                }
            }
        } catch (error) {
            console.error('Autoplay Error:', error);
            if (channel) {
                channel.send({ content: `${config.emojis.warning} **Autoplay Error**: An unexpected error occurred.` }).catch(console.error);
            }
        }
    }
    
    // Don't disconnect if 24/7 mode is enabled
    if (client.twentyFourSeven.has(guildId)) return;
    
    if (channel) {
        channel.send({ content: 'Queue ended! Leaving voice channel in 1 minute unless new songs are added.' }).catch(console.error);
        
        // Set a timeout to destroy the player if no new songs are added
        setTimeout(() => {
            const currentPlayer = client.kazagumo.players.get(guildId);
            if (currentPlayer && currentPlayer.queue.isEmpty && !client.twentyFourSeven.has(guildId)) {
                currentPlayer.destroy();
                channel.send({ content: 'Left voice channel due to inactivity.' }).catch(console.error);
            }
        }, 60000);
    }
});

client.kazagumo.on('playerException', (player, error) => {
    console.error('Player Exception:', error);
    const channel = client.channels.cache.get(player.textId);
    
    // Determine if we need to recover the player
    let needsRecovery = false;
    let errorMessage = `${config.emojis.warning} **An error occurred while playing**: ${error.message || 'Unknown error'}`;
    
    if (error.message) {
        if (error.message.includes('destroyed') || error.message.includes('not found')) {
            // Player was destroyed or not found
            errorMessage = `${config.emojis.warning} **Connection Error**: Music player was disconnected unexpectedly. Use a command to reconnect.`;
            needsRecovery = false; // Let the user reconnect manually
        } else if (error.message.includes('Track stuck') || error.message.includes('load failed')) {
            // Track playback issues
            errorMessage = `${config.emojis.warning} **Playback Error**: The current track failed to load or got stuck. Skipping to the next song...`;
            needsRecovery = true;
        } else if (error.message.includes('Connection') || error.message.includes('WebSocket')) {
            // Connection issues
            errorMessage = `${config.emojis.warning} **Connection Error**: Lost connection to the music server. Attempting to reconnect...`;
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
    let errorMessage = `${config.emojis.warning} **Player Error**: ${error.message || 'Unknown error'}`;
    
    if (error.message) {
        if (error.message.includes('No available nodes')) {
            errorMessage = `${config.emojis.warning} **Connection Error**: Cannot connect to the music server. Please try again later.`;
        } else if (error.message.includes('Failed to decode')) {
            errorMessage = `${config.emojis.warning} **Playback Error**: This track cannot be played due to format issues. Please try another song.`;
        } else if (error.message.includes('Track information not available')) {
            errorMessage = `${config.emojis.warning} **Track Error**: Could not retrieve track information. The source may be unavailable.`;
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
                                    channel.send({ content: `${config.emojis.play} Successfully reconnected to the voice channel.` }).catch(console.error);
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
client.login(process.env.DISCORD_TOKEN).catch(console.error);
