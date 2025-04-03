const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Leaves the voice channel and clears the queue'),
    
    async execute(interaction) {
        try {
            const { client } = interaction;
            const guildId = interaction.guildId;
            
            // Check if the member is in a voice channel
            const member = interaction.member;
            if (!member.voice.channel) {
                return interaction.reply({ 
                    embeds: [errorEmbed('You need to be in a voice channel to use this command!')], 
                    ephemeral: true 
                });
            }
            
            // Check if there's an active player
            const player = client.kazagumo.players.get(guildId);
            if (!player) {
                return interaction.reply({ 
                    embeds: [errorEmbed("I'm not currently in a voice channel!")], 
                    ephemeral: true 
                });
            }
            
            // Check if the user is in the same voice channel as the bot
            if (player.voiceId !== member.voice.channelId) {
                return interaction.reply({ 
                    embeds: [errorEmbed('You need to be in the same voice channel as me to use this command!')], 
                    ephemeral: true 
                });
            }
            
            // Destroy the player (clears queue and disconnects)
            await player.destroy();
            
            // Create success message
            const leaveEmbed = createEmbed({
                title: `Left Voice Channel`,
                description: `I've left <#${member.voice.channelId}> and cleared the queue.`,
                color: config.embedColor,
                footer: `Requested by ${interaction.user.tag}`,
                timestamp: true
            });
            
            return interaction.reply({ embeds: [leaveEmbed] });
        } catch (error) {
            console.error('Error in leave command:', error);
            return interaction.reply({ 
                embeds: [errorEmbed(`An error occurred: ${error.message}`)], 
                ephemeral: true 
            });
        }
    },
};