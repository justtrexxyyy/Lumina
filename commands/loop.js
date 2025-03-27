const { SlashCommandBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('🔁 Set loop mode')
        .addStringOption(option => 
            option.setName('mode')
                .setDescription('Loop mode to set')
                .setRequired(true)
                .addChoices(
                    { name: 'Off', value: 'none' },
                    { name: 'Track', value: 'track' },
                    { name: 'Queue', value: 'queue' }
                )),
    
    async execute(interaction) {
        const { client } = interaction;
        const guildId = interaction.guildId;
        const loopMode = interaction.options.getString('mode');
        
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
        
        // Set the loop mode
        player.setLoop(loopMode);
        
        // Get emoji based on loop mode
        let emoji;
        let modeText;
        
        switch (loopMode) {
            case 'none':
                emoji = '➡️';
                modeText = 'Disabled';
                break;
            case 'track':
                emoji = '🔂';
                modeText = 'Current Track';
                break;
            case 'queue':
                emoji = '🔁';
                modeText = 'Queue';
                break;
            default:
                emoji = '❓';
                modeText = 'Unknown';
        }
        
        const loopEmbed = createEmbed({
            title: `${emoji} Loop Mode: ${modeText}`,
            description: `Loop mode has been set to **${modeText}**`,
            footer: `Requested by ${interaction.user.tag}`,
            timestamp: true
        });
        
        await interaction.reply({ embeds: [loopEmbed] });
    },
};
