const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embeds');
const config = require('../config');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View statistics'),
    
    async execute(interaction) {
        const { client } = interaction;
        
        // Collect general stats
        const serverCount = client.guilds.cache.size;
        const channelCount = client.channels.cache.size;
        const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const activeVoiceConnections = client.kazagumo.players.size;
        
        // Collect uptime stats
        const botUptime = formatUptime(client.uptime);
        const systemUptime = formatUptime(os.uptime() * 1000);
        
        // Collect system stats
        const memoryUsage = process.memoryUsage();
        const memoryUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        const memoryTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const cpuCount = os.cpus().length;
        const cpuModel = os.cpus()[0].model;
        const cpuUsage = process.cpuUsage();
        const cpuUsagePercent = ((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(2);
        
        // Get Lavalink node stats if available
        let lavalinkStats = 'No data available';
        let playersCount = 'Unknown';
        let memoryUsedLavalink = 'Unknown';
        let uptimeLavalink = 'Unknown';
        
        try {
            const { shoukaku } = client.kazagumo;
            const node = shoukaku.nodes.get('Main Node');
            
            if (node && node.stats) {
                const stats = node.stats;
                playersCount = stats.players || 'Unknown';
                memoryUsedLavalink = stats.memory ? `${(stats.memory.used / 1024 / 1024).toFixed(2)} MB` : 'Unknown';
                uptimeLavalink = stats.uptime ? formatUptime(stats.uptime) : 'Unknown';
                
                lavalinkStats = `Memory: ${memoryUsedLavalink}\nPlayers: ${playersCount}\nUptime: ${uptimeLavalink}`;
            }
        } catch (error) {
            console.error('Error getting Lavalink stats:', error);
        }
        
        // Create and send the stats embed
        const statsEmbed = createEmbed({
            title: `${config.botName} Statistics`,
            fields: [
                {
                    name: '🤖 Bot Stats',
                    value: [
                        `Servers: ${serverCount}`,
                        `Channels: ${channelCount}`,
                        `Users: ${userCount}`,
                        `Active Players: ${activeVoiceConnections}`,
                        `Uptime: ${botUptime}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '💻 System Stats',
                    value: [
                        `Memory: ${memoryUsed} MB / ${memoryTotal} GB`,
                        `CPU: ${cpuModel}`,
                        `CPU Cores: ${cpuCount}`,
                        `CPU Usage: ${cpuUsagePercent}%`,
                        `Uptime: ${systemUptime}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🎵 Lavalink Stats',
                    value: lavalinkStats,
                    inline: false
                }
            ],
            footer: `Discord.js v${require('discord.js').version} • Node.js ${process.version}`,
            timestamp: true
        });
        
        await interaction.reply({ embeds: [statsEmbed] });
    },
};

// Helper function to format uptime
function formatUptime(ms) {
    if (!ms || isNaN(ms)) return 'Unknown';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    
    return parts.join(' ');
}
