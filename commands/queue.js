const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { formatDuration } = require('../utils/formatters');
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
        
        // Create queue description without text-based music card
        // Determine source for current track
        const currentSourceIcon = '🔴';
        
        let queueDescription = `**Now Playing:**\n${currentSourceIcon} ${current.isStream ? 'LIVE | ' : ''}[${current.title}](${config.supportServer}) | ${formatDuration(current.isStream ? 0 : current.length)}\n\n`;
        
        if (queue.length > 0) {
            queueDescription += `**Up Next:**\n`;
            
            const startIndex = (page - 1) * tracksPerPage;
            const endIndex = Math.min(startIndex + tracksPerPage, queue.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                const track = queue[i];
                queueDescription += `**${i + 1}.** ${track.isStream ? 'LIVE ' : ''}[${track.title}](${config.supportServer}) | ${track.isStream ? 'LIVE' : formatDuration(track.length)}\n`;
            }
        } else {
            queueDescription += `**Up Next:**\nNo more tracks in queue`;
        }
        
        // Add queue stats
        const queueStats = [
            `Total Tracks: ${queue.length + 1}`,
            `Total Duration: ${formatTotalDuration(totalQueueDuration)}`,
            `Loop Mode: ${getLoopModeName(player.loop)}`,
            `Volume: ${player.volume}%`
        ];
        
        const queueEmbed = createEmbed({
            title: `Queue for ${interaction.guild.name}`,
            description: queueDescription,
            fields: [
                {
                    name: 'Queue Info',
                    value: queueStats.join(' | ')
                }
            ],
            footer: `Page ${page}/${totalPages} | Use /queue <page> to view more`,
            timestamp: true
        });
        
        // Add navigation buttons if there are multiple pages
        if (totalPages > 1) {
            queueEmbed.footer.text += ` | ${queue.length} tracks in queue`;
        }
        
        await interaction.reply({ embeds: [queueEmbed] });
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
