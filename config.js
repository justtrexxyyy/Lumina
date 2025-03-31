module.exports = {
    botName: 'Audic',
    botLogo: 'https://i.imgur.com/KoIfEYT.jpg',
    botDescription: 'Your ultimate music bot for seamless audio streaming on Discord.',
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
        play: '<:play:1234567890123456789>',
        pause: '<:pause:1234567890123456789>',
        stop: '<:stop:1234567890123456789>',
        skip: '<:skip:1234567890123456789>',
        volume: '<:volume:1234567890123456789>',
        queue: '<:queue:1234567890123456789>',
        nowPlaying: '<:nowplaying:1234567890123456789>',
        shuffle: '<:shuffle:1234567890123456789>',
        loop: '<:loop:1234567890123456789>',
        remove: '<:remove:1234567890123456789>',
        move: '<:move:1234567890123456789>',
        twentyFourSeven: '<:247:1234567890123456789>',
        ping: '<:ping:1234567890123456789>',
        stats: '<:stats:1234567890123456789>',
        invite: '<:invite:1234567890123456789>',
        support: '<:support:1234567890123456789>',
        music: '<:music:1234567890123456789>',
        artist: '<:artist:1234567890123456789>',
        duration: '<:duration:1234567890123456789>',
        user: '<:user:1234567890123456789>',
        autoplay: '<:autoplay:1234567890123456789>',
        warning: '<:warning:1234567890123456789>',
        connect: '<:connect:1234567890123456789>',
        filters: '<:filters:1234567890123456789>',
        lyrics: '<:lyrics:1234567890123456789>',
        info: '<:info:1234567890123456789>'
    }
};
