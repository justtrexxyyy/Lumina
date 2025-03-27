module.exports = {
    botName: 'Audic',
    botLogo: 'https://imgur.com/a/nwcB4b0', // Updated logo link
    botDescription: 'Advanced music bot with high-quality audio playback and extensive playlist management features.',
    embedColor: '#5865F2',
    defaultVolume: 50,
    supportServer: process.env.SUPPORT_SERVER || 'https://discord.gg/discord-api',
    lavalink: {
        nodes: [
            {
                name: 'Main Node',
                url: `${process.env.LAVALINK_HOST || 'unknownz.info.gf'}:${process.env.LAVALINK_PORT || '9146'}`,
                auth: process.env.LAVALINK_PASSWORD || 'unknownz',
                secure: false,
            }
        ]
    },
    emojis: {
        play: '▶️',
        pause: '⏸️',
        stop: '⏹️',
        skip: '⏭️',
        volume: '🔊',
        queue: '📜',
        nowPlaying: '🎵',
        shuffle: '🔀',
        loop: '🔁',
        remove: '❌',
        move: '↕️',
        twentyFourSeven: '🔄',
        ping: '📡',
        stats: '📊',
        invite: '📨',
        support: '📢'
    }
};
