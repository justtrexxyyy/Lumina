const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Toggle autoplay mode to automatically add related tracks when queue ends'),
    
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
        
        // Toggle autoplay
        if (!client.autoplay) client.autoplay = new Set();
        
        const autoplayEnabled = client.autoplay.has(guildId);
        
        if (autoplayEnabled) {
            client.autoplay.delete(guildId);
            
            const disabledEmbed = createEmbed({
                title: `${config.emojis.stop} Autoplay Disabled`,
                description: `Autoplay mode has been **disabled**. I will no longer automatically add related tracks when the queue ends.`,
                footer: `Requested by ${interaction.user.tag}`,
                timestamp: true
            });
            
            await interaction.reply({ embeds: [disabledEmbed] });
        } else {
            client.autoplay.add(guildId);
            
            const enabledEmbed = createEmbed({
                title: `${config.emojis.autoplay} Autoplay Enabled`,
                description: `Autoplay mode has been **enabled**. I will automatically add related tracks when the queue ends.`,
                footer: `Requested by ${interaction.user.tag}`,
                timestamp: true
            });
            
            await interaction.reply({ embeds: [enabledEmbed] });
        }
    },
};