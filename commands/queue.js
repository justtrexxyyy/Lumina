const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { formatDuration, createMusicCard } = require('../utils/formatters');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('View current queue')
        .addIntegerOption(option => 
            option.setName('page')
                .setDescription('Page number to view')
                .setRequired(false)
                .setMinValue(1)),
    
    async execute(interaction) {
        const { client } = interaction;
        const guildId = interaction.guildId;
        const requestedPage = interaction.options.getInteger('page') || 1;
        
        // Get the player for this guild
        const player = client.kazagumo.players.get(guildId);
        
        if (!player) {
            return interaction.reply({ embeds: [errorEmbed('There is no active player in this server!')], ephemeral: true });
        }
        
        // Get current queue
        const queue = player.queue;
        const current = queue.current;
        
        if (!current) {
            return interaction.reply({ embeds: [errorEmbed('There is no track currently playing!')], ephemeral: true });
        }
        
        // Calculate queue pages
        const tracksPerPage = 10;
        const totalPages = Math.ceil(queue.length / tracksPerPage) || 1;
        
        // Validate page number
        const page = Math.min(requestedPage, totalPages);
        
        // Calculate total queue duration
        let totalQueueDuration = queue.reduce((acc, track) => {
            if (track.isStream) return acc;
            return acc + track.length;
        }, 0);
        
        // Add current track duration if it's not a stream
        if (!current.isStream) {
            totalQueueDuration += current.length - player.position;
        }
        
        // Create a simplified music card for the currently playing track
        const currentCard = createMusicCard(current, true);
        
        // Create description for upcoming tracks in the queue
        let upcomingDescription = '';
        if (queue.length > 0) {
            const startIndex = (page - 1) * tracksPerPage;
            const endIndex = Math.min(startIndex + tracksPerPage, queue.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                const track = queue[i];
                upcomingDescription += `**${i + 1}.** ${track.author ? `${track.author} • ` : ''}[${track.title}](${config.supportServer}) • ${track.isStream ? 'LIVE' : formatDuration(track.length)}\n`;
            }
        } else {
            upcomingDescription = 'No more tracks in queue';
        }
        
        // Add queue stats
        const queueStats = [
            `Total Tracks: ${queue.length + 1}`,
            `Total Duration: ${formatTotalDuration(totalQueueDuration)}`,
            `Loop Mode: ${getLoopModeName(player.loop)}`,
            `Volume: ${player.volume}%`
        ];
        
        // Send both the current music card and the queue info
        const queueEmbed = createEmbed({
            title: `Queue for ${interaction.guild.name}`,
            description: `**Up Next:**\n${upcomingDescription}`,
            fields: [
                {
                    name: 'Queue Info',
                    value: queueStats.join(' | ')
                }
            ],
            footer: `Page ${page}/${totalPages} | Use /queue <page> to view more`,
            thumbnail: current.thumbnail
        });
        
        // Add navigation buttons if there are multiple pages
        if (totalPages > 1) {
            // For our custom implementation, the footer is a string, not an object
            queueEmbed.footer = `${queueEmbed.footer} | ${queue.length} tracks in queue`;
        }
        
        await interaction.reply({ 
            embeds: [currentCard, queueEmbed] 
        });
    },
};

// Helper functions
function formatTotalDuration(ms) {
    if (ms <= 0) return '0 seconds';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    const parts = [];
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
    
    return parts.join(', ');
}

function getLoopModeName(loopMode) {
    switch (loopMode) {
        case 'none': return `Off`;
        case 'track': return `Current Track`;
        case 'queue': return `Queue`;
        default: return `Off`;
    }
}
