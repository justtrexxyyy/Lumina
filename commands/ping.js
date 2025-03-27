const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('📡 Check latency'),
    
    async execute(interaction) {
        // Defer the reply to calculate accurate API latency
        await interaction.deferReply();
        
        // Calculate bot latency (API ping)
        const apiLatency = Math.round(interaction.client.ws.ping);
        
        // Calculate message latency (round trip time)
        const start = Date.now();
        const reply = await interaction.editReply('Pinging...');
        const messageLatency = Date.now() - start;
        
        // Get Lavalink node stats if available
        let lavalinkLatency = 'N/A';
        
        try {
            const { shoukaku } = interaction.client.kazagumo;
            const node = shoukaku.nodes.get('Main Node');
            
            if (node && node.stats) {
                lavalinkLatency = `${node.stats.ping || 'N/A'}ms`;
            }
        } catch (error) {
            console.error('Error getting Lavalink stats:', error);
        }
        
        // Create and send the ping embed
        const pingEmbed = createEmbed({
            title: `${config.emojis.ping} Pong!`,
            fields: [
                {
                    name: 'API Latency',
                    value: `${apiLatency}ms`,
                    inline: true
                },
                {
                    name: 'Message Latency',
                    value: `${messageLatency}ms`,
                    inline: true
                },
                {
                    name: 'Lavalink Latency',
                    value: lavalinkLatency,
                    inline: true
                }
            ],
            footer: 'Discord Music Bot',
            timestamp: true
        });
        
        await interaction.editReply({ content: null, embeds: [pingEmbed] });
    },
};
