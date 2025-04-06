const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { formatDuration, createProgressBar, createMusicCard } = require('../utils/formatters');
const { getActiveFilter, getFilterDisplayName, hasActiveFilter } = require('../utils/filters');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show currently playing track'),
    
    async execute(interaction) {
        const { client } = interaction;
        const guildId = interaction.guildId;
        
        // Get the player for this guild
        const player = client.kazagumo.players.get(guildId);
        
        if (!player) {
            return interaction.reply({ embeds: [errorEmbed('There is no active player in this server!')], ephemeral: true });
        }
        
        // Get current track
        const current = player.queue.current;
        
        if (!current) {
            return interaction.reply({ embeds: [errorEmbed('There is no track currently playing!')], ephemeral: true });
        }
        
        // Generate music card image
        const musicCard = await createMusicCard(current, true);
        
        // Check if response is buffer (image) or embed (fallback)
        const reply = Buffer.isBuffer(musicCard) ? 
            { files: [{ attachment: musicCard, name: 'nowplaying.png' }] } :
            { embeds: [musicCard] };
        
        // Get position and create progress bar
        const position = player.position;
        const duration = current.length;
        const isStream = current.isStream;
        
        // Create progress bar and add it to the description
        const progressBar = isStream ? 'LIVE' : createProgressBar(position, duration);
        
        // Check if there's an active filter
        const activeFilter = hasActiveFilter(player) ? getFilterDisplayName(getActiveFilter(player)) : 'None';
        
        // Add progress bar to the embed description
        musicCard.description += `\n\n${progressBar}`;
        
        // Add minimal fields for additional info that should still be shown
        musicCard.fields = [
            {
                name: 'Volume',
                value: `${player.volume}%`,
                inline: true
            },
            {
                name: 'Filter',
                value: activeFilter,
                inline: true
            },
            {
                name: 'Loop',
                value: getLoopModeName(player.loop),
                inline: true
            }
        ];
        
        // Reply with the music card
        await interaction.reply({ embeds: [musicCard] });
    },
};

// Helper function to get loop mode display name
function getLoopModeName(loopMode) {
    switch (loopMode) {
        case 'none': return 'Off';
        case 'track': return 'Current Track';
        case 'queue': return 'Queue';
        default: return 'Off';
    }
}


