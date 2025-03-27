const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop and disconnect'),
    
    async execute(interaction) {
        const { client } = interaction;
        const guildId = interaction.guildId;
        
        // Check if the user is in a voice channel
        const member = interaction.member;
        const voiceChannel = member.voice.channel;
        
        if (!voiceChannel) {
            return interaction.reply({ embeds: [errorEmbed('You need to be in a voice channel to use this command!')], ephemeral: true });
        }
        
        // Get the player for this guild
        const player = client.kazagumo.players.get(guildId);
        
        if (!player) {
            return interaction.reply({ embeds: [errorEmbed('There is no active player in this server!')], ephemeral: true });
        }
        
        // Check if the user is in the same voice channel as the bot
        if (player.voiceId !== voiceChannel.id) {
            return interaction.reply({ embeds: [errorEmbed('You need to be in the same voice channel as me!')], ephemeral: true });
        }
        
        // Check if 24/7 mode is enabled and remove it
        if (client.twentyFourSeven.has(guildId)) {
            client.twentyFourSeven.delete(guildId);
        }
        
        // Stop and destroy the player
        player.destroy();
        
        const stopEmbed = createEmbed({
            title: `${config.emojis.stop} Player Stopped`,
            description: 'The player has been stopped and I have left the voice channel.',
            footer: `Requested by ${interaction.user.tag}`,
            timestamp: true
        });
        
        await interaction.reply({ embeds: [stopEmbed] });
    },
};
