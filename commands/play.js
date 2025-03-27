const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from name/URL')
        .addStringOption(option => 
            option.setName('query')
                .setDescription('Song name or URL')
                .setRequired(true)),
    
    async execute(interaction) {
        const { client } = interaction;
        const query = interaction.options.getString('query');
        const guildId = interaction.guildId;
        const textChannel = interaction.channel;
        
        // Check if the user is in a voice channel
        const member = interaction.member;
        const voiceChannel = member.voice.channel;
        
        if (!voiceChannel) {
            return interaction.reply({ embeds: [errorEmbed('You need to be in a voice channel to use this command!')], ephemeral: true });
        }
        
        // Check bot permissions for the voice channel
        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return interaction.reply({ 
                embeds: [errorEmbed('I need permissions to join and speak in your voice channel!')], 
                ephemeral: true 
            });
        }
        
        await interaction.deferReply();
        
        try {
            // Create or get the player
            const player = client.kazagumo.createPlayer({
                guildId: guildId,
                voiceId: voiceChannel.id,
                textId: textChannel.id,
                deaf: true
            });
            
            // Resolve and add the track to the queue
            const result = await client.kazagumo.search(query, { requester: interaction.user });
            
            if (!result || !result.tracks.length) {
                return interaction.editReply({ embeds: [errorEmbed('No results found for your query!')] });
            }
            
            // Handle different result types
            if (result.type === 'PLAYLIST') {
                // Add all tracks from playlist to queue
                player.queue.add(result.tracks);
                
                const playlistEmbed = createEmbed({
                    title: `${config.emojis.play} Playlist Added to Queue`,
                    description: `Added **${result.tracks.length}** songs from [${result.playlistName}](${query})`,
                    fields: [
                        {
                            name: 'Enqueued By',
                            value: `<@${interaction.user.id}>`,
                            inline: true
                        },
                        {
                            name: 'Total Duration',
                            value: calculatePlaylistDuration(result.tracks),
                            inline: true
                        }
                    ],
                    timestamp: true
                });
                
                await interaction.editReply({ embeds: [playlistEmbed] });
            } else {
                // Add single track to queue
                const track = result.tracks[0];
                player.queue.add(track);
                
                const trackEmbed = createEmbed({
                    title: `${config.emojis.play} Track Added to Queue`,
                    description: `[${track.title}](${track.uri})`,
                    fields: [
                        {
                            name: 'Duration',
                            value: track.isStream ? '🔴 LIVE' : formatDuration(track.length),
                            inline: true
                        },
                        {
                            name: 'Position in Queue',
                            value: `#${player.queue.size}`,
                            inline: true
                        },
                        {
                            name: 'Requested By',
                            value: `<@${interaction.user.id}>`,
                            inline: true
                        }
                    ],
                    thumbnail: track.thumbnail,
                    timestamp: true
                });
                
                await interaction.editReply({ embeds: [trackEmbed] });
            }
            
            // Play the track if the player isn't playing
            if (!player.playing && !player.paused) {
                player.play();
            }
        } catch (error) {
            console.error('Error while playing track:', error);
            await interaction.editReply({ 
                embeds: [errorEmbed(`An error occurred: ${error.message || 'Unknown error'}`)]
            });
        }
    },
};

// Helper functions
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    let result = '';
    if (hours > 0) {
        result += `${hours}:`;
        result += `${minutes.toString().padStart(2, '0')}:`;
    } else {
        result += `${minutes}:`;
    }
    result += `${seconds.toString().padStart(2, '0')}`;

    return result;
}

function calculatePlaylistDuration(tracks) {
    const totalMs = tracks.reduce((acc, track) => {
        if (track.isStream) return acc;
        return acc + track.length;
    }, 0);
    
    const seconds = Math.floor((totalMs / 1000) % 60);
    const minutes = Math.floor((totalMs / (1000 * 60)) % 60);
    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    
    const parts = [];
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
    
    return parts.join(', ');
}
