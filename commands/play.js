const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
            // Resolve the track/playlist
            const result = await client.kazagumo.search(query, { requester: interaction.user });
            
            if (!result || !result.tracks.length) {
                return interaction.editReply({ embeds: [errorEmbed('No results found for your query!')] });
            }
            
            // Create or get the player
            const player = client.kazagumo.players.get(guildId) || await client.kazagumo.createPlayer({
                guildId: guildId,
                voiceId: voiceChannel.id,
                textId: textChannel.id,
                deaf: true
            });
            
            // Handle different result types
            if (result.type === 'PLAYLIST') {
                // Add all tracks from playlist
                player.queue.add(result.tracks);
                
                const playlistEmbed = createEmbed({
                    description: `${config.emojis.play} Added [${result.playlistName}](${query}) to the queue`,
                    timestamp: true
                });
                
                await interaction.editReply({ embeds: [playlistEmbed], components: [] });
            } else {
                // Add single track
                const track = result.tracks[0];
                player.queue.add(track);
                
                // Create simplified track added embed
                const trackEmbed = createEmbed({
                    description: `${config.emojis.play} Added ${track.isStream ? '🔴 LIVE' : ''} [${track.title}](${track.uri}) to the queue`,
                    timestamp: true
                });
                
                await interaction.editReply({ embeds: [trackEmbed], components: [] });
            }
            
            // Start playback if not already playing
            if (!player.playing && !player.paused) {
                await player.play();
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

function getLoopModeName(loopMode) {
    switch (loopMode) {
        case 'none': return 'Off';
        case 'track': return 'Current Track';
        case 'queue': return 'Queue';
        default: return 'Off';
    }
}
