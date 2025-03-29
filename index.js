require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Shoukaku, Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');
const config = require('./config');

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
client.kazagumo.on('playerStart', (player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
        // Add artist information if available
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
            color: parseInt(config.embedColor.replace('#', ''), 16)
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
});

client.kazagumo.on('playerEmpty', async (player) => {
    const channel = client.channels.cache.get(player.textId);
    const guildId = player.guildId;
    
    // Initialize autoplay set if it doesn't exist
    if (!client.autoplay) client.autoplay = new Set();
    
    // Check if autoplay is enabled for this guild
    if (client.autoplay.has(guildId)) {
        // Get the last played track to find related tracks
        const lastTrack = player.queue.previous;
        
        if (lastTrack && lastTrack.uri) {
            try {
                // Send a message that we're searching for similar tracks
                if (channel) {
                    channel.send({ content: `${config.emojis.autoplay} **Autoplay**: Searching for similar tracks...` }).catch(console.error);
                }
                
                // Verify lastTrack has a valid URI before searching
                console.log(`Autoplay: Checking last track: ${JSON.stringify({
                    title: lastTrack.title,
                    uri: lastTrack.uri,
                    author: lastTrack.author
                })}`);
                
                if (!lastTrack.uri) {
                    console.log(`Autoplay: Missing URI for last track, cannot search for related tracks`);
                    if (channel) {
                        channel.send({ content: `${config.emojis.warning} **Autoplay Error**: Cannot find related tracks due to missing track information.` }).catch(console.error);
                    }
                    return;
                }
                
                // Search for related tracks with a fallback search strategy
                console.log(`Autoplay: Searching for tracks related to: ${lastTrack.uri}`);
                
                // Try to search by URI first
                let result = await client.kazagumo.search(lastTrack.uri, { requester: lastTrack.requester }).catch(e => {
                    console.log(`Autoplay: Error searching by URI: ${e.message}`);
                    return null;
                });
                
                // If URI search fails, try searching by title and artist
                if (!result || !result.tracks || result.tracks.length === 0) {
                    const searchQuery = `${lastTrack.author ? lastTrack.author + ' - ' : ''}${lastTrack.title}`;
                    console.log(`Autoplay: URI search failed, trying by title/artist: "${searchQuery}"`);
                    
                    result = await client.kazagumo.search(searchQuery, { requester: lastTrack.requester }).catch(e => {
                        console.log(`Autoplay: Error searching by title: ${e.message}`);
                        return null;
                    });
                }
                
                if (result && result.tracks && result.tracks.length > 0) {
                    console.log(`Autoplay: Found ${result.tracks.length} related tracks`);
                    
                    // Filter out the track that just played (comparing by title if URI isn't available)
                    const filteredTracks = result.tracks.filter(track => 
                        (lastTrack.uri && track.uri !== lastTrack.uri) || 
                        (!lastTrack.uri && track.title !== lastTrack.title)
                    );
                    
                    console.log(`Autoplay: After filtering, ${filteredTracks.length} tracks remain`);
                    
                    if (filteredTracks.length > 0) {
                        // Randomly select one of the related tracks
                        const randomIndex = Math.floor(Math.random() * filteredTracks.length);
                        const randomTrack = filteredTracks[randomIndex];
                        console.log(`Autoplay: Selected track ${randomIndex+1}/${filteredTracks.length}: ${randomTrack.title}`);
                        
                        try {
                            // Add the track to the queue
                            player.queue.add(randomTrack);
                            
                            // Play it (since the queue was empty)
                            if (!player.playing && !player.paused) {
                                console.log(`Autoplay: Starting playback of the new track`);
                                player.play().catch(e => {
                                    console.error(`Autoplay: Error starting playback: ${e.message}`);
                                    if (channel) {
                                        channel.send({ content: `${config.emojis.warning} **Autoplay Error**: Failed to play the next track: ${e.message}` }).catch(console.error);
                                    }
                                });
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
                        console.log(`Autoplay: No tracks remain after filtering out the previously played track`);
                    }
                } else {
                    console.log(`Autoplay: No related tracks found or search failed`);
                }
            } catch (error) {
                console.error('Autoplay Error:', error);
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

// Helper function for formatting duration
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
}

// Login to Discord
client.login(process.env.DISCORD_TOKEN).catch(console.error);
