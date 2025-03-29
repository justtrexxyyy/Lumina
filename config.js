module.exports = {
    botName: 'Audic',
    botLogo: 'https://cdn.discordapp.com/attachments/1098183940499591188/1354742079561007254/copilot_image_1742024927163.jpg?ex=67e66561&is=67e513e1&hm=40a4effcb6c1e0bef698782fdfa5af13e2eaa8d0ccbd26fc86cafd09a872ad8f&',
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
        warning: '⚠️'
    }
};
