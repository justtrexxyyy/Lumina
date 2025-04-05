const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { formatDuration, createProgressBar } = require('../utils/formatters');
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
        
        // Get position and create progress bar
        const position = player.position;
        const duration = current.length;
        const isStream = current.isStream;
        const positionFormatted = formatDuration(position);
        const durationFormatted = isStream ? 'LIVE' : formatDuration(duration);
        
        // Create progress bar
        const progressBar = isStream ? 'LIVE' : createProgressBar(position, duration);
        
        // Get loop mode display
        const loopMode = getLoopModeName(player.loop);
        
        // Format requester properly
        const requesterDisplay = current.requester ? `<@${current.requester.id}>` : 'Unknown';
        
        // Determine source based on the URI
        const isYouTube = current.uri && (current.uri.includes('youtube.com') || current.uri.includes('youtu.be'));
        const isSoundCloud = current.uri && current.uri.includes('soundcloud.com');
        const sourceDisplay = isSoundCloud ? '🧡 SoundCloud' : (isYouTube ? '🔴 YouTube' : 'Unknown');
        
        // Build the embed
        const npEmbed = createEmbed({
            title: `Now Playing ${current.isStream ? '(LIVE)' : ''}`,
            thumbnail: current.thumbnail || config.botLogo,
            fields: [
                {
                    name: 'Track',
                    value: `[${current.title}](${config.supportServer})`,
                    inline: false
                },
                {
                    name: 'Artist',
                    value: current.author || 'Unknown',
                    inline: true
                },
                {
                    name: 'Requested By',
                    value: requesterDisplay,
                    inline: true
                },
                {
                    name: 'Duration',
                    value: isStream ? 'LIVE' : `${positionFormatted} / ${durationFormatted}`,
                    inline: true
                },
                {
                    name: 'Volume',
                    value: `${player.volume}%`,
                    inline: true
                },
                {
                    name: 'Loop',
                    value: loopMode,
                    inline: true
                },
                {
                    name: 'Queue',
                    value: `${player.queue.length} track(s)`,
                    inline: true
                },
                {
                    name: 'Source',
                    value: sourceDisplay,
                    inline: true
                }
            ],
            description: isStream ? null : progressBar
        });
        
        // Reply with just the embed and no buttons
        await interaction.reply({ embeds: [npEmbed] });
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


