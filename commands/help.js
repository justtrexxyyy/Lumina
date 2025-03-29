const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } = require('discord.js');
const config = require('../config');
const { createEmbed } = require('../utils/embeds');
const { getAvailableFilters, getFilterDisplayName } = require('../utils/filters');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands with interactive categories'),
    
    async execute(interaction) {
        const { emojis } = config;
        
        // Define command categories
        const categories = {
            music: {
                name: '🎵 Music Commands',
                description: 'Commands to control music playback',
                emoji: '🎵',
                commands: [
                    { name: 'play', description: 'Play a song from name/URL', emoji: emojis.play },
                    { name: 'pause', description: 'Pause current playback', emoji: emojis.pause },
                    { name: 'resume', description: 'Resume playback', emoji: emojis.play },
                    { name: 'stop', description: 'Stop and disconnect', emoji: emojis.stop },
                    { name: 'skip', description: 'Skip to next song', emoji: emojis.skip },
                    { name: 'join', description: 'Make the bot join your voice channel', emoji: emojis.connect },
                    { name: 'leave', description: 'Make the bot leave your voice channel', emoji: emojis.connect },
                    { name: 'volume', description: 'Adjust volume (0-100)', emoji: emojis.volume },
                    { name: 'queue', description: 'View current queue', emoji: emojis.queue },
                    { name: 'nowplaying', description: 'Show current track', emoji: emojis.nowPlaying },
                    { name: 'shuffle', description: 'Shuffle the queue', emoji: emojis.shuffle },
                    { name: 'loop', description: 'Set loop mode', emoji: emojis.loop },
                    { name: 'remove', description: 'Remove a song', emoji: emojis.remove },
                    { name: 'move', description: 'Move track position', emoji: emojis.move },
                    { name: 'autoplay', description: 'Toggle autoplay mode', emoji: emojis.autoplay },
                    { name: 'lyrics', description: 'Get lyrics for the current or specified song', emoji: emojis.lyrics || '📝' }
                ]
            },
            filters: {
                name: '🎛️ Audio Filters',
                description: 'Apply audio filters to enhance your music',
                emoji: '🎛️',
                commands: [
                    { name: 'bassboost', description: 'Enhance bass frequencies', emoji: '🔊' },
                    { name: '8d', description: 'Apply 8D audio effect (rotation)', emoji: '🔄' },
                    { name: 'karaoke', description: 'Reduce vocals for karaoke', emoji: '🎤' },
                    { name: 'nightcore', description: 'Speed up and add tremolo', emoji: '⏩' },
                    { name: 'vaporwave', description: 'Slow down and alter pitch', emoji: '🌊' },
                    { name: 'slowmode', description: 'Slow down playback', emoji: '⏪' },
                    { name: 'lowpass', description: 'Filter high frequencies', emoji: '📉' },
                    { name: 'timescale', description: 'Custom speed/pitch/rate', emoji: '⏲️' },
                    { name: 'clearfilter', description: 'Clear all active filters', emoji: '🔄' }
                ]
            },
            utility: {
                name: '⚙️ Utility Commands',
                description: 'Bot utility and management commands',
                emoji: '⚙️',
                commands: [
                    { name: '247', description: 'Toggle 24/7 mode', emoji: emojis.twentyFourSeven },
                    { name: 'ping', description: 'Check bot latency', emoji: emojis.ping },
                    { name: 'stats', description: 'View bot statistics', emoji: emojis.stats },
                    { name: 'invite', description: 'Invite bot to server', emoji: emojis.invite },
                    { name: 'support', description: 'Join support server', emoji: emojis.support },
                    { name: 'help', description: 'Display this help menu', emoji: '❓' }
                ]
            }
        };
        
        // Create main help embed with overview
        const mainHelpEmbed = createEmbed({
            title: `${config.botName} - Help Menu`,
            description: `${config.botDescription}\n\nSelect a category from the dropdown menu below to view specific commands.`,
            thumbnail: config.botLogo,
            fields: [
                {
                    name: '🎵 Music Commands',
                    value: `Music playback control commands. Select the Music category to see all ${categories.music.commands.length} commands.`,
                    inline: true
                },
                {
                    name: '🎛️ Audio Filters',
                    value: `Apply audio effects to your music. Select the Filters category to see all ${categories.filters.commands.length} filters.`,
                    inline: true
                },
                {
                    name: '⚙️ Utility Commands',
                    value: `Bot utility and management commands. Select the Utility category to see all ${categories.utility.commands.length} commands.`,
                    inline: true
                },
                {
                    name: `${emojis.invite} Invite Bot`,
                    value: `[Click here to invite ${config.botName} to your server](https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID || '123456789012345678'}&permissions=277083450432&scope=bot%20applications.commands)`,
                    inline: false
                },
                {
                    name: `${emojis.support} Support Server`,
                    value: `[Join our support server](${config.supportServer}) for help and updates.`,
                    inline: false
                }
            ],
            footer: `${config.botName} • Developed by Unknownz`,
            timestamp: true
        });
        
        // Create the select menu for categories
        const categorySelect = new StringSelectMenuBuilder()
            .setCustomId('category_select')
            .setPlaceholder('Select a command category')
            .addOptions([
                // Add Home option at the beginning
                new StringSelectMenuOptionBuilder()
                    .setLabel('🏠 Home')
                    .setDescription('Return to main help menu')
                    .setValue('home')
                    .setEmoji('🏠'),
                // Add all other category options
                ...Object.keys(categories).map(key => {
                    const category = categories[key];
                    return new StringSelectMenuOptionBuilder()
                        .setLabel(category.name)
                        .setDescription(category.description)
                        .setValue(key)
                        .setEmoji(category.emoji);
                })
            ]);
        
        const selectRow = new ActionRowBuilder().addComponents(categorySelect);
        
        // Send the initial embed with only the dropdown menu (no buttons)
        const response = await interaction.reply({ 
            embeds: [mainHelpEmbed], 
            components: [selectRow],
            fetchReply: true 
        });
        
        // Create a collector for the select menu interactions
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect,
            time: 120000 // 2 minutes timeout
        });
        
        collector.on('collect', async (selectInteraction) => {
            // Get the selected category
            const categoryKey = selectInteraction.values[0];
            
            // Handle Home selection
            if (categoryKey === 'home') {
                // Return to the main help menu
                await selectInteraction.update({ 
                    embeds: [mainHelpEmbed], 
                    components: [selectRow] 
                });
                return;
            }
            
            // Handle category selection
            const category = categories[categoryKey];
            
            if (!category) {
                // This shouldn't happen, but just in case
                await selectInteraction.reply({ content: 'Invalid category selected.', ephemeral: true });
                return;
            }
            
            // Create the embed for the selected category
            const categoryEmbed = createEmbed({
                title: `${category.emoji} ${category.name}`,
                description: category.description,
                thumbnail: config.botLogo,
                fields: category.commands.map(cmd => ({
                    name: `${cmd.emoji} /${cmd.name}`,
                    value: cmd.description,
                    inline: true
                })),
                footer: `${config.botName} • Developed by Unknownz`,
                timestamp: true
            });
            
            // Update the message with the new embed
            await selectInteraction.update({ embeds: [categoryEmbed], components: [selectRow] });
        });
        
        collector.on('end', async () => {
            // Disable the select menu when the collector expires
            categorySelect.setDisabled(true);
            try {
                await interaction.editReply({ components: [new ActionRowBuilder().addComponents(categorySelect)] });
            } catch (error) {
                // Might fail if the message is too old
                console.error('Failed to disable select menu after timeout:', error);
            }
        });
    },
};
