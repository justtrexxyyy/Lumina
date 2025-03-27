const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { formatDuration, createProgressBar } = require('../utils/formatters');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('🎵 Show current track'),
    
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
        
        let progressBar = '';
        if (!isStream) {
            progressBar = `${createProgressBar(position, duration)}\n${positionFormatted} / ${durationFormatted}`;
        }
        
        // Get source platform
        const sourcePlatform = getSourcePlatform(current.uri);
        
        // Simplified fields to match screenshot
        const fields = [
            {
                name: 'Duration',
                value: isStream ? '🔴 LIVE' : durationFormatted,
                inline: false
            },
            {
                name: 'Requested By',
                value: `<@${current.requester.id}>`,
                inline: false
            }
        ];
        
        const npEmbed = createEmbed({
            title: `🎵 Now Playing`,
            description: `[${current.title}](${current.uri})`,
            fields: fields,
            thumbnail: current.thumbnail,

            timestamp: true
        });
        
        // No buttons for nowplaying command as requested
        await interaction.reply({ 
            embeds: [npEmbed]
        });
    },
};

// Helper functions
function getSourcePlatform(uri) {
    if (uri.includes('youtube.com') || uri.includes('youtu.be')) {
        return 'YouTube';
    } else if (uri.includes('spotify.com')) {
        return 'Spotify';
    } else if (uri.includes('soundcloud.com')) {
        return 'SoundCloud';
    } else if (uri.includes('twitch.tv')) {
        return 'Twitch';
    } else {
        return 'Unknown';
    }
}

function getLoopModeName(loopMode) {
    switch (loopMode) {
        case 'none': return 'Off';
        case 'track': return 'Current Track';
        case 'queue': return 'Queue';
        default: return 'Off';
    }
}
