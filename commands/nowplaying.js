const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
        
        // Create embed fields
        const fields = [
            {
                name: 'Requested By',
                value: `<@${current.requester.id}>`,
                inline: true
            },
            {
                name: 'Source',
                value: sourcePlatform,
                inline: true
            }
        ];
        
        // Add duration/position for non-streams
        if (!isStream) {
            fields.push({
                name: 'Duration',
                value: durationFormatted,
                inline: true
            });
        } else {
            fields.push({
                name: 'Duration',
                value: '🔴 LIVE',
                inline: true
            });
        }
        
        // Add current volume
        fields.push({
            name: 'Volume',
            value: `${player.volume}%`,
            inline: true
        });
        
        // Add loop mode
        fields.push({
            name: 'Loop Mode',
            value: getLoopModeName(player.loop),
            inline: true
        });
        
        // Add queue size
        fields.push({
            name: 'Queue',
            value: `${player.queue.length} track${player.queue.length !== 1 ? 's' : ''}`,
            inline: true
        });
        
        const npEmbed = createEmbed({
            title: `${config.emojis.nowPlaying} Now Playing`,
            description: `[${current.title}](${current.uri})${progressBar ? `\n\n${progressBar}` : ''}`,
            fields: fields,
            thumbnail: current.thumbnail,
            footer: `Use /queue to view the full queue`,
            timestamp: true
        });
        
        // Create control buttons
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pause_resume')
                    .setLabel(player.paused ? 'Resume' : 'Pause')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('skip')
                    .setLabel('Skip')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('stop')
                    .setLabel('Stop')
                    .setStyle(ButtonStyle.Danger)
            );
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('queue')
                    .setLabel('Queue')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('loop')
                    .setLabel('Loop: ' + getLoopModeName(player.loop))
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.reply({ 
            embeds: [npEmbed],
            components: [row1, row2]
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
