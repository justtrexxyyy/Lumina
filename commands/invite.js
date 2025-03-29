const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Invite bot to server'),
    
    async execute(interaction) {
        try {
            // Defer the reply to give us more time to respond
            await interaction.deferReply();
            
            // Get client ID from environment or use interaction.client.user.id
            const clientId = process.env.CLIENT_ID || interaction.client.user.id;
            
            // Use a fixed permission code instead of calculating it
            // This fixed value covers all the permissions we need (277083450432)
            const permissions = 277083450432;
            
            // Generate the invite link
            const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot%20applications.commands`;
            
            const inviteEmbed = createEmbed({
                title: `${config.emojis.invite} Invite ${config.botName}`,
                description: `Thank you for your interest in ${config.botName}!\n\nClick the buttons below to invite the bot or join our support server:`,
                fields: [
                    {
                        name: 'Invite Link',
                        value: `[Click here to invite ${config.botName}](${inviteLink})`,
                        inline: false
                    },
                    {
                        name: 'Support Server',
                        value: `[Join our support server](${config.supportServer})`,
                        inline: false
                    }
                ],
                footer: 'Thanks for using our bot!',
                timestamp: true
            });
            
            // Create buttons for invite and support server
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Invite Bot')
                        .setStyle(ButtonStyle.Link)
                        .setURL(inviteLink),
                    new ButtonBuilder()
                        .setLabel('Join Support Server')
                        .setStyle(ButtonStyle.Link)
                        .setURL(config.supportServer)
                );
            
            // Edit the deferred reply
            await interaction.editReply({ embeds: [inviteEmbed], components: [row] });
        } catch (error) {
            console.error('Error in invite command:', error);
            
            // If interaction hasn't been acknowledged, acknowledge it
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Sorry, there was an error processing your request.', ephemeral: true });
            } else {
                // If already acknowledged, follow up or edit the reply
                await interaction.followUp({ content: 'Sorry, there was an error processing your request.', ephemeral: true });
            }
        }
    },
};
