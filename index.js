require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Shoukaku, Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');
const config = require('./config');
const { formatDuration } = require('./utils/formatters');
const { createEmbed } = require('./utils/embeds');

// Add startup debugging logs
console.log('Starting Discord Music Bot...');
console.log('Environment variables present:');
console.log('DISCORD_TOKEN exists:', !!process.env.DISCORD_TOKEN);
console.log('DISCORD_TOKEN length:', process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.length : 0);
console.log('CLIENT_ID exists:', !!process.env.CLIENT_ID);
console.log('CLIENT_ID length:', process.env.CLIENT_ID ? process.env.CLIENT_ID.length : 0);
console.log('LAVALINK_HOST:', process.env.LAVALINK_HOST);
console.log('LAVALINK_PORT:', process.env.LAVALINK_PORT);

// Set timeout to detect if login takes too long
setTimeout(() => {
    console.log('Login is taking longer than expected (10 seconds)...');
}, 10000);

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
client.nowPlayingMessages = new Map(); // Map to store Now Playing messages (guildId -> messageId)

// Initialize Shoukaku and Kazagumo with more robust error handling
const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), config.lavalink.nodes, {
    moveOnDisconnect: false,
    resume: true,
    resumeTimeout: 60, // Increased from 30 to 60
    reconnectTries: 5, // Increased from 2 to 5
    restTimeout: 15000, // Increased from 10000 to 15000
    userAgent: 'Audic/1.0.0',
    structures: {
        // Set debug to false to disable all WebSocket debug logs
        debug: false
    }
});

client.kazagumo = new Kazagumo({
    defaultSearchEngine: 'youtube', // Keep YouTube as default but we'll add support for SoundCloud
    sources: {
        youtube: true,   // Enable YouTube source
        soundcloud: true // Enable SoundCloud source
    },
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
shoukaku.on('close', (name, code, reason) => {
    // Only log server closure for non-normal close codes
    if (code !== 1000 && code < 4000) {
        console.warn(`Lavalink ${name}: Closed, Code ${code}`);
        setTimeout(() => {
            try {
                shoukaku.reconnect();
            } catch (reconnectErr) {
                // Only log critical reconnection errors
                console.error(`Reconnection failed`);
            }
        }, 5000);
    }
});
// Removed debug event listener to reduce log spam
shoukaku.on('disconnect', (name, players, moved) => {
    if (moved) return;
    players.map(player => player.connection.disconnect());
    
    setTimeout(() => {
        try {
            shoukaku.reconnect();
        } catch (reconnectErr) {
            // Only log critical errors
            console.error(`Reconnection failed`);
        }
    }, 5000);
});
shoukaku.on('error', (name, error) => {
    console.error(`Lavalink ${name} Error:`, error.message || 'Unknown error');
    
    // Handle various error types with customized reconnection strategies
    if (error && error.message) {
        // Prepare for reconnection
        let reconnectDelay = 10000; // Default 10 seconds
        
        if (error.message.includes('AbortError')) {
            console.log('Connection aborted, will try again shortly...');
            reconnectDelay = 5000; // Shorter delay for abort errors
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('Connection refused')) {
            console.log('Connection refused, server may be down. Will retry in a moment...');
            reconnectDelay = 15000; // Longer delay for refused connections
        } else if (error.message.includes('Transport failed') || error.message.includes('Connection reset')) {
            console.log('Transport error detected, reconnecting...');
            reconnectDelay = 7500; // Medium delay for transport issues
        }
        
        // Schedule reconnection with the appropriate delay
        setTimeout(() => {
            try {
                shoukaku.reconnect();
                console.log(`Attempting to reconnect to Lavalink ${name}...`);
            } catch (reconnectErr) {
                console.error(`Failed to reconnect to Lavalink ${name}:`, reconnectErr.message || 'Unknown error');
            }
        }, reconnectDelay);
    }
});

// Kazagumo events
client.kazagumo.on('playerStart', async (player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
        try {
            // Create smaller embed with createEmbed instead of setAuthor to avoid iconURL issues
            const embed = createEmbed({
                title: 'Now Playing',
                thumbnail: track.thumbnail || null,
                description: `**[${track.title}](${process.env.SUPPORT_SERVER || 'https://discord.gg/76W85cu3Uy'})**\n${track.isStream ? 'LIVE' : formatDuration(track.length)} • <@${track.requester.id}>`
            });
            
            // Add buttons and filter select menu for now playing message
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
            
            // Button row with essential controls
            const nowPlayingRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pauseresume')
                        .setLabel('Pause/Resume')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('replay')
                        .setLabel('Replay')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('skip')
                        .setLabel('Skip')
                        .setStyle(ButtonStyle.Secondary)
                );
                
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
            
            // Add additional control buttons
            const controlsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('shuffle')
                        .setLabel('Shuffle')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('stop')
                        .setLabel('Stop')
                        .setStyle(ButtonStyle.Danger)
                );
            
            // Send the embed with controls and filter dropdown
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
                description: `[${track.title}](${process.env.SUPPORT_SERVER || 'https://discord.gg/76W85cu3Uy'})`,
                footer: 'Error occurred while creating the full embed'
            });
            
            // Create a simplified dropdown for fallback
            const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            
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

            // Add a basic controls row as well for fallback
            const fallbackControlsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pauseresume')
                        .setLabel('Pause/Resume')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('skip')
                        .setLabel('Skip')
                        .setStyle(ButtonStyle.Secondary)
                );
                
            channel.send({ 
                embeds: [embed],
                components: [fallbackFilterRow, fallbackControlsRow]
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
    
    // When player is empty, send a message with working buttons to inform users
    if (channel) {
        // Create buttons that work even with no active player
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('play')
                    .setLabel('Play Music')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('leave')
                    .setLabel('Leave Channel')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        // Send a queue ended message with buttons
        try {
            await channel.send({
                embeds: [createEmbed({
                    title: 'Queue Ended',
                    description: 'The music queue has ended.\nUse the buttons below or type `/play` to play more music!'
                })],
                components: [actionRow]
            });
        } catch (error) {
            console.error('Error sending queue ended message:', error);
        }
    }
    
    // Autoplay functionality
    if (client.autoplay && client.autoplay.has(guildId) && player.queue.previous && player.queue.previous.length > 0) {
        try {
            // Get the last played track
            const lastTrack = player.queue.previous[player.queue.previous.length - 1];
            if (!lastTrack) return;
            
            // Search for related tracks on SoundCloud
            const result = await client.kazagumo.search(lastTrack.title || lastTrack.uri, {
                engine: 'soundcloud', // Use SoundCloud for autoplay
                requester: lastTrack.requester
            });
            
            if (result && result.tracks.length > 0) {
                // Filter out tracks that were already played to avoid repetition
                const playedTrackUris = new Set();
                if (player.queue.previous) {
                    player.queue.previous.forEach(track => playedTrackUris.add(track.uri));
                }
                
                // Get new tracks that haven't been played yet
                const newTracks = result.tracks.filter(track => !playedTrackUris.has(track.uri));
                
                if (newTracks.length > 0) {
                    // Add up to 3 tracks to the queue
                    const tracksToAdd = newTracks.slice(0, 3);
                    player.queue.add(tracksToAdd);
                    
                    // Start playing if not already playing
                    if (!player.playing && !player.paused) {
                        await player.play();
                    }
                    
                    // Send info message about autoplay
                    if (channel) {
                        const autoplayEmbed = createEmbed({
                            title: 'Autoplay',
                            description: `Added ${tracksToAdd.length} similar tracks to the queue.`
                        });
                        
                        await channel.send({ embeds: [autoplayEmbed] }).catch(() => {
                            // Silently handle error without logging to console
                        });
                    }
                    
                    // Return early since we're continuing playback
                    return;
                }
            }
        } catch (error) {
            // Handle error silently without logging to console
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
    // Only log critical errors
    if (error && error.message && error.message.includes('destroyed')) {
        console.error('Critical player exception:', error.message);
    }
    
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
                player.skip().catch(() => {
                    // If skip fails, try to stop and destroy
                    player.destroy().catch(() => {});
                });
            } else {
                player.destroy().catch(() => {});
            }
        } catch (recoveryError) {
            // Silent catch
        }
    }
});

client.kazagumo.on('playerError', (player, error) => {
    // Only log critical errors
    if (error && error.message && (error.message.includes('No available nodes') || error.message.includes('destroyed'))) {
        console.error('Critical player error:', error.message);
    }
    
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
        channel.send({ content: errorMessage }).catch(() => {});
    }
    
    // Attempt to reconnect if needed
    if (error.message && 
        (error.message.includes('No available nodes') || 
         error.message.includes('Connection') || 
         error.message.includes('WebSocket'))) {
        
        setTimeout(() => {
            try {
                // Check if Lavalink nodes are available
                const nodesAvailable = shoukaku.nodes.filter(node => node.state === 1);
                
                if (nodesAvailable.length > 0) {
                    const guildId = player.guildId;
                    const voiceId = player.voiceId;
                    const textId = player.textId;
                    
                    // Destroy current player
                    player.destroy().catch(() => {});
                    
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
                                    channel.send({ content: `Successfully reconnected to the voice channel.` }).catch(() => {});
                                }
                            } catch (e) {
                                // Silent catch for failed player creation
                            }
                        }
                    }, 2000);
                }
            } catch (reconnectError) {
                // Silent catch
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
                    },

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
        if (['pauseresume', 'pause', 'resume', 'skip', 'stop', 'queue', 'shuffle', 'loop', 'replay'].includes(interaction.customId)) {
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
                    case 'pauseresume':
                    case 'pause':
                        // Toggle pause state
                        player.pause(!player.paused);
                        return interaction.reply({ 
                            content: player.paused ? 'Paused the playback!' : 'Resumed the playback!', 
                            ephemeral: true 
                        });
                        
                    case 'resume':
                        // Resume playback
                        player.pause(false);
                        return interaction.reply({ 
                            content: 'Resumed the playback!', 
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
                        
                    case 'replay':
                        // Replay the current track
                        if (!player.queue.current) {
                            return interaction.reply({ 
                                content: 'There is no track currently playing!', 
                                ephemeral: true 
                            });
                        }
                        
                        // Record the current track to replay it
                        const currentTrack = player.queue.current;
                        
                        // Skip the current track and immediately add it back to the beginning of the queue
                        player.queue.unshift(currentTrack);
                        player.skip();
                        
                        return interaction.reply({ 
                            content: 'Replaying the current track!', 
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

// Add more detailed error handling for login
console.log('Attempting to log in to Discord...');

// Add a 30-second timeout for login
const loginTimeout = setTimeout(() => {
    console.error('Discord login timeout after 30 seconds. Possible network issue or invalid token.');
    console.error('Please check your internet connection and verify the bot token is valid.');
    console.error('The process will now exit to prevent hanging.');
    process.exit(1); // Exit with error code
}, 30000);

client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        clearTimeout(loginTimeout); // Clear the timeout if login succeeds
        console.log('Successfully logged in to Discord!');
    })
    .catch(error => {
        clearTimeout(loginTimeout); // Clear the timeout if login fails with an error
        console.error('Failed to log in to Discord:', error.message);
        
        if (error.message.includes('token')) {
            console.error('DISCORD_TOKEN is invalid. Please check your environment variables.');
        } else if (error.message.includes('network') || error.message.includes('connect')) {
            console.error('Network error. Please check your internet connection.');
        } else {
            console.error('Unknown error occurred during login. Please try again later.');
        }
        
        process.exit(1); // Exit with error code
    });
