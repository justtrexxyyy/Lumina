
module.exports = {
    botName: 'Lumina',
    botDescription: 'Your ultimate music bot for seamless audio streaming on Discord.',
    embedColor: '#7289DA',
    supportServer: process.env.SUPPORT_SERVER || 'https://discord.gg/rw7pGzzjBF',
    botLogo: 'https://cdn.discordapp.com/attachments/1380506143746560097/1390878111800754266/standard_2.gif?ex=6869dbaf&is=68688a2f&hm=ff2adac22fe1f500d9a076fd4cdcb70b22a5223ac20efb54ae9ae5bf12d22c54&',
    genius: {
        apiKey: process.env.GENIUS_API_KEY,
        clientToken: process.env.GENIUS_CLIENT_TOKEN,
        accessToken: process.env.GENIUS_ACCESS_TOKEN
    },
    emojis: {
        play: '',
        pause: '',
        stop: '',
        skip: '',
        previous: '',
        repeat: '',
        loading: '',
        error: '',
        success: '',
        queue: '',
        music: '',
        volume: '',
        time: '',
        user: '',
        duration: '',
        spotify: '',
        soundcloud: '',
        youtube: '',
        loopTrack: '',
        loopQueue: '',
        loopOff: ''
    },
    lavalink: {
        nodes: [
            {
                name: 'Main',
                url: 'lavalink.jirayu.net:13592',
                auth: 'youshallnotpass',
                secure: false,
                retryAmount: 5,
                retryDelay: 3000
            }
        ]
    }
};
