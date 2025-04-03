module.exports = {
    botName: 'Audic',
    botLogo: '',
    botDescription: 'Your ultimate music bot for seamless audio streaming on Discord.',
    embedColor: '#5865F2',
    defaultVolume: 50,
    supportServer: process.env.SUPPORT_SERVER || 'https://discord.gg/76W85cu3Uy',
    emojis: {
        // Empty emojis config for minimalist design
    },
    lavalink: {
        nodes: [
            {
                name: 'Main Node',
                url: `${process.env.LAVALINK_HOST || 'lava-v4.ajieblogs.eu.org'}:${process.env.LAVALINK_PORT || '80'}`,
                auth: process.env.LAVALINK_PASSWORD || 'https://dsc.gg/ajidevserver',
                secure: false,
            }
        ]
    }
};
