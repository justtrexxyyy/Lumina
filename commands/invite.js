const { SlashCommandBuilder } = require('discord.js');
const { createEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Invite bot to server'),
    
    async execute(interaction) {
        const { client } = interaction;
        
        // Generate invite link with required permissions
        // Permissions:
        // - View Channels
        // - Send Messages
        // - Embed Links
        // - Attach Files
        // - Read Message History
        // - Use External Emojis
        // - Add Reactions
        // - Connect
        // - Speak
        // - Use Voice Activity
        
        const requiredPermissions = [
            'ViewChannel',
            'SendMessages',
            'EmbedLinks',
            'AttachFiles',
            'ReadMessageHistory',
            'UseExternalEmojis',
            'AddReactions',
            'Connect',
            'Speak',
            'UseVAD'
        ];
        
        // Use a fixed permission code instead of calculating it
        // This fixed value covers all the permissions we need (277083450432)
        const permissions = 277083450432;
        
        const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=${permissions}&scope=bot%20applications.commands`;
        
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
        
        await interaction.reply({ embeds: [inviteEmbed], components: [row] });
    },
};
