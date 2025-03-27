module.exports = {
    botName: 'Music Bot',
    embedColor: '#5865F2',
    defaultVolume: 50,
    supportServer: process.env.SUPPORT_SERVER || 'https://discord.gg/yourserver',
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
