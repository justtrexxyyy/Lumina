const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { formatDuration, createProgressBar } = require('../utils/formatters');
const { createMusicCard } = require('../utils/imageCard');
const config = require('../config');
const path = require('path');
const fs = require('fs');

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
        
        // Get source platform
        const sourcePlatform = getSourcePlatform(current.uri);
        
        // Defer the reply while we generate the image
        await interaction.deferReply();
        
        try {
            // Generate image-based music card
            const musicCardPath = await createMusicCard(current, position, player.volume, sourcePlatform, {
                requester: current.requester,
                loopMode: player.loop,
                queueSize: player.queue.length
            });
            
            // Create attachment from the generated image
            const attachment = new AttachmentBuilder(musicCardPath, { name: 'music_card.jpg' });
            
            // No buttons needed anymore
            
            // Get the next 3 tracks in queue for display
            let queueInfo = '';
            if (player.queue.length > 0) {
                queueInfo = player.queue.slice(0, 3).map((track, index) => {
                    return `**${index + 1}.** [${track.title}](${track.uri}) - ${formatDuration(track.length)}`;
                }).join('\n');
                
                // Add a message if there are more tracks
                if (player.queue.length > 3) {
                    queueInfo += `\n... and ${player.queue.length - 3} more track${player.queue.length - 3 !== 1 ? 's' : ''}`;
                }
            } else {
                queueInfo = 'No tracks in queue';
            }
            
            // Enhanced embed with title, image card, and footer (no queue)
            const npEmbed = {
                title: `🎵 Now Playing ${current.isStream ? '(Live Stream)' : ''}`,
                description: `**[${current.title}](${current.uri})**\nRequested by: ${current.requester}`,
                image: {
                    url: 'attachment://music_card.jpg'
                },
                color: parseInt(config.embedColor.replace('#', ''), 16),
                footer: {
                    text: `Loop: ${getLoopModeName(player.loop)} | Volume: ${player.volume}%`
                }
            };
            
            // Edit the deferred reply with the embed and attachment, without buttons
            await interaction.editReply({ 
                embeds: [npEmbed],
                files: [attachment],
                components: [] // No buttons
            });
            
            // Clean up the temporary file after sending
            fs.unlink(musicCardPath, (err) => {
                if (err) console.error('Error removing temporary music card file:', err);
            });
            
        } catch (error) {
            console.error('Error generating music card:', error);
            
            // Fallback to simpler embed without the image card
            const progressBar = isStream ? 'LIVE' : createProgressBar(position, duration);
            
            // Get the next 3 tracks in queue for display
            let queueInfo = '';
            if (player.queue.length > 0) {
                queueInfo = player.queue.slice(0, 3).map((track, index) => {
                    return `**${index + 1}.** [${track.title}](${track.uri}) - ${formatDuration(track.length)}`;
                }).join('\n');
                
                // Add a message if there are more tracks
                if (player.queue.length > 3) {
                    queueInfo += `\n... and ${player.queue.length - 3} more track${player.queue.length - 3 !== 1 ? 's' : ''}`;
                }
            } else {
                queueInfo = 'No tracks in queue';
            }
            
            // Create minimal fallback fields with simplified layout (no queue)
            const fields = [
                {
                    name: 'Track Info',
                    value: `**Duration:** ${isStream ? '🎬 LIVE' : durationFormatted}\n**Source:** ${sourcePlatform}\n**Volume:** ${player.volume}%`,
                    inline: true
                },
                {
                    name: 'Status',
                    value: `**Position:** ${isStream ? 'N/A' : positionFormatted}\n**Loop:** ${getLoopModeName(player.loop)}\n**Queue:** ${player.queue.length} tracks`,
                    inline: true
                }
            ];
            
            const npEmbed = {
                title: `🎵 Now Playing ${current.isStream ? '(Live Stream)' : ''}`,
                description: `**[${current.title}](${current.uri})**\nRequested by: ${current.requester}`,
                fields: fields,
                thumbnail: {
                    url: current.thumbnail || config.botLogo
                },
                color: parseInt(config.embedColor.replace('#', ''), 16),
                footer: {
                    text: `Loop: ${getLoopModeName(player.loop)} | Volume: ${player.volume}%`
                }
            };
            
            // Edit the deferred reply with the fallback embed
            await interaction.editReply({ 
                embeds: [npEmbed]
            });
        }
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


