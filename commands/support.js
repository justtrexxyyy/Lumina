const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('support')
        .setDescription('📢 Join support server'),
    
    async execute(interaction) {
        const supportEmbed = createEmbed({
            title: `${config.emojis.support} Support Server`,
            description: `Need help with ${config.botName}? Join our support server for assistance!`,
            fields: [
                {
                    name: '🔗 Support Server',
                    value: `[Click here to join](${config.supportServer})`,
                    inline: false
                },
                {
                    name: '📋 Issues & Feedback',
                    value: 'You can report issues, suggest features, or get help with commands in our support server.',
                    inline: false
                }
            ],
            footer: 'Thanks for using our bot!',
            timestamp: true
        });
        
        await interaction.reply({ embeds: [supportEmbed] });
    },
};
