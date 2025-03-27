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
shoukaku.on('error', (name, error) => console.error(`Lavalink ${name}: Error Caught,`, error));
shoukaku.on('close', (name, code, reason) => console.warn(`Lavalink ${name}: Closed, Code ${code}, Reason ${reason || 'No reason'}`));
shoukaku.on('disconnect', (name, reason) => console.warn(`Lavalink ${name}: Disconnected, Reason ${reason || 'No reason'}`));

// Kazagumo events
client.kazagumo.on('playerStart', (player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
        const embed = {
            title: `${config.emojis.nowPlaying} Now Playing`,
            description: `[${track.title}](${track.uri})`,
            fields: [
                {
                    name: 'Duration',
                    value: track.isStream ? '🔴 LIVE' : formatDuration(track.length),
                    inline: true
                },
                {
                    name: 'Requested By',
                    value: `<@${track.requester.id}>`,
                    inline: true
                }
            ],
            color: parseInt(config.embedColor.replace('#', ''), 16)
        };
        channel.send({ embeds: [embed] }).catch(console.error);
    }
});

client.kazagumo.on('playerEmpty', (player) => {
    const channel = client.channels.cache.get(player.textId);
    const guildId = player.guildId;
    
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
    if (channel) {
        channel.send({ content: `An error occurred while playing: ${error.message || 'Unknown error'}` }).catch(console.error);
    }
});

client.kazagumo.on('playerError', (player, error) => {
    console.error('Player Error:', error);
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
        channel.send({ content: `An error occurred with the player: ${error.message || 'Unknown error'}` }).catch(console.error);
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
