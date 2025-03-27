const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const { createEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands'),
    
    async execute(interaction) {
        const { emojis } = config;
        
        const helpEmbed = createEmbed({
            title: `${config.botName} - Help Menu`,
            description: config.botDescription,
            thumbnail: config.botLogo,
            fields: [
                {
                    name: '🎵 Music Commands',
                    value: [
                        `${emojis.play} </play:0> - Play a song from name/URL`,
                        `${emojis.pause} </pause:0> - Pause current playback`,
                        `${emojis.play} </resume:0> - Resume playback`,
                        `${emojis.stop} </stop:0> - Stop and disconnect`,
                        `${emojis.skip} </skip:0> - Skip to next song`,
                        `${emojis.volume} </volume:0> - Adjust volume (0-100)`,
                        `${emojis.queue} </queue:0> - View current queue`,
                        `${emojis.nowPlaying} </nowplaying:0> - Show current track`,
                        `${emojis.shuffle} </shuffle:0> - Shuffle the queue`,
                        `${emojis.loop} </loop:0> - Set loop mode`,
                        `${emojis.remove} </remove:0> - Remove a song`,
                        `${emojis.move} </move:0> - Move track position`,
                    ].join('\n')
                },
                {
                    name: '⚙️ Utility Commands',
                    value: [
                        `${emojis.twentyFourSeven} </247:0> - Toggle 24/7 mode`,
                        `${emojis.ping} </ping:0> - Check latency`,
                        `${emojis.stats} </stats:0> - View statistics`,
                        `${emojis.invite} </invite:0> - Invite bot to server`,
                        `${emojis.support} </support:0> - Join support server`,
                    ].join('\n')
                }
            ],
            footer: `${config.botName} • Powered by Shoukaku & Kazagumo`,
            timestamp: true
        });

        // Create button row with only invite button to avoid URL validation issues
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Invite Bot')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID || '123456789012345678'}&permissions=277083450432&scope=bot%20applications.commands`)
            );
        
        await interaction.reply({ embeds: [helpEmbed], components: [row] });
    },
};
