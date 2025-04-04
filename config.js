
module.exports = {
    botName: 'Audic',
    embedColor: '#7289DA',
    supportServer: 'https://discord.gg/76W85cu3Uy',
    botLogo: '',
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
