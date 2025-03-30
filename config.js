module.exports = {
    botName: 'Audic',
    botLogo: 'https://i.imgur.com/KoIfEYT.jpg',
    botDescription: 'Advanced music bot with high-quality audio playback and extensive playlist management features.',
    embedColor: '#5865F2',
    defaultVolume: 50,
    supportServer: process.env.SUPPORT_SERVER || 'https://discord.gg/76W85cu3Uy',
    lavalink: {
        nodes: [
            {
                name: 'Main Node',
                url: `${process.env.LAVALINK_HOST || 'lava-v4.ajieblogs.eu.org'}:${process.env.LAVALINK_PORT || '80'}`,
                auth: process.env.LAVALINK_PASSWORD || 'https://dsc.gg/ajidevserver',
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
        support: '📢',
        music: '🎧',
        artist: '👤',
        duration: '⏱️',
        user: '🙋‍♂️',
        autoplay: '♾️',
        warning: '⚠️',
        connect: '🔌',
        filters: '🎛️',
        lyrics: '📝',
        info: 'ℹ️'
    }
};
