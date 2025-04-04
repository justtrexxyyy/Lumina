const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { formatDuration } = require('../utils/formatters');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for a song and choose one to play')
        .addStringOption(option => 
            option.setName('query')
                .setDescription('The song to search for')
                .setRequired(true)),
    
    async execute(interaction) {
        const { client, member } = interaction;
        const guildId = interaction.guildId;
        const query = interaction.options.getString('query');
        
        // Check if user is in a voice channel
        if (!member.voice.channel) {
            return interaction.reply({ 
                content: 'You need to be in a voice channel to use this command!',
                ephemeral: true 
            });
        }
        
        await interaction.deferReply();
        
        try {
            // Search for tracks with better error handling
            const searchResult = await client.kazagumo.search(query, { 
                engine: 'youtube',
                requester: interaction.user 
            }).catch(error => {
                console.error('Search error:', error);
                // Display a more user-friendly error message
                if (error.message && error.message.includes('Connect Timeout Error')) {
                    throw new Error('Connection to music server timed out. Please try again later.');
                } else if (error.message && error.message.includes('fetch failed')) {
                    throw new Error('Unable to connect to music server. Please try again soon.');
                } else {
                    throw new Error(`Unable to search: ${error.message || 'Unknown error'}`);
                }
            });
            
            if (!searchResult || !searchResult.tracks || !searchResult.tracks.length) {
                return interaction.editReply({ 
                    content: `No results found for: ${query}`
                });
            }
            
            // Limit to 10 results maximum and filter out videos
            const tracks = searchResult.tracks
                .filter(track => track && track.title && !track.title.toLowerCase().includes('video'))
                .slice(0, 10);
            
            if (!tracks.length) {
                return interaction.editReply({ 
                    content: `No music results found for: ${query} (filtered out videos)`
                });
            }
            
            // Create select menu with search results
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('search-select')
                .setPlaceholder('Select a track to play');
                
            // Add each track as an option
            tracks.forEach((track, index) => {
                const duration = track.isStream ? 'LIVE' : formatDuration(track.length);
                selectMenu.addOptions({
                    label: `${index + 1}. ${track.title.substring(0, 80)}${track.title.length > 80 ? '...' : ''}`,
                    description: `${track.author ? track.author.substring(0, 80) : 'Unknown'} [${duration}]`.substring(0, 95),
                    value: index.toString()
                });
            });
            
            const row = new ActionRowBuilder().addComponents(selectMenu);
            
            // Create embed with all search results
            const searchEmbed = createEmbed({
                title: 'Search Results',
                description: `Here are the search results for: **${query}**\n\nSelect a track to play from the dropdown menu below.`,
                thumbnail: client.user.displayAvatarURL()
            });
            
            const response = await interaction.editReply({
                embeds: [searchEmbed],
                components: [row]
            });
            
            // Create collector for select menu interaction
            const collector = response.createMessageComponentCollector({ 
                componentType: ComponentType.StringSelect,
                time: 30000 // 30 seconds
            });
            
            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ 
                        content: 'This menu is not for you!', 
                        ephemeral: true 
                    });
                }
                
                // Get selected track
                const selectedIndex = parseInt(i.values[0]);
                const selectedTrack = tracks[selectedIndex];
                
                try {
                    // We'll try directly without checking for node connections first
                    // This allows us to attempt the connection even if we can't directly verify node status
                    
                    // Create or get player with error handling
                    const player = client.kazagumo.createPlayer({
                        guildId: guildId,
                        voiceId: member.voice.channel.id,
                        textId: interaction.channelId,
                        deaf: true
                    });
                    
                    // Play the selected track
                    player.queue.add(selectedTrack);
                    
                    if (!player.playing && !player.paused) {
                        await player.play();
                    }
                    
                    await i.update({ 
                        content: `Added to queue: **${selectedTrack.title}**`, 
                        embeds: [], 
                        components: [] 
                    });
                } catch (error) {
                    console.error('Error playing selected track:', error);
                    await i.update({ 
                        content: `Error playing track: ${error.message || 'Unknown error'}. Please try again.`, 
                        embeds: [], 
                        components: [] 
                    });
                }
                
                // End collector after selection
                collector.stop();
            });
            
            collector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    interaction.editReply({ 
                        content: 'Search selection timed out.', 
                        embeds: [], 
                        components: [] 
                    }).catch(() => {});
                }
            });
            
        } catch (error) {
            console.error('Error in search command:', error);
            return interaction.editReply({ 
                content: `An error occurred while searching: ${error.message}` 
            });
        }
    },
};