const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { formatDuration, createProgressBar, createMusicCard } = require('../utils/formatters');
const { getActiveFilter, getFilterDisplayName, hasActiveFilter } = require('../utils/filters');
const config = require('../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show currently playing track'),
    
    async execute(interaction) {
        try {
            console.log("Executing nowplaying command");
            const { client } = interaction;
            const guildId = interaction.guildId;
            
            // Get the player for this guild
            const player = client.kazagumo.players.get(guildId);
            
            if (!player) {
                return interaction.reply({ embeds: [errorEmbed('There is no active player in this server!')], ephemeral: true });
            }
            
            // Get current track
            const current = player.queue.current;
            
            if (!current) {
                return interaction.reply({ embeds: [errorEmbed('There is no track currently playing!')], ephemeral: true });
            }
            
            console.log("Creating music card for:", current.title);
            // Generate music card image
            const musicCard = await createMusicCard(current, true);
            console.log("Music card created, type:", Buffer.isBuffer(musicCard) ? "Buffer" : "Embed fallback");
            
            // Get position and create progress bar
            const position = player.position;
            const duration = current.length;
            const isStream = current.isStream;
            
            // Create progress bar
            const progressBar = isStream ? 'LIVE' : createProgressBar(position, duration);
            
            // Check if there's an active filter
            const activeFilter = hasActiveFilter(player) ? getFilterDisplayName(getActiveFilter(player)) : 'None';
            
            // Prepare the reply based on whether music card is an image or fallback embed
            let reply;
            
            if (Buffer.isBuffer(musicCard)) {
                // For the image buffer, we'll create an attachment using AttachmentBuilder
                const attachment = new AttachmentBuilder(musicCard, { name: 'nowplaying.png' });
                
                // Create the embed properly
                const embed = createEmbed({
                    title: 'Now Playing',
                    description: `**[${current.title}](${config.supportServer})**\n<@${current.requester.id}>\n\n**Progress**: ${progressBar}\n**Volume**: ${player.volume}% | **Filter**: ${activeFilter} | **Loop**: ${getLoopModeName(player.loop)}`,
                    color: '#87CEEB', // Sky blue to match the card
                });
                
                // Explicitly set the image URL
                embed.setImage('attachment://nowplaying.png');
                
                reply = {
                    embeds: [embed],
                    files: [attachment]
                };
            } else {
                // Fallback to the embed if image creation failed
                // Add progress bar to the embed description
                musicCard.description += `\n\n${progressBar}`;
                
                // Add minimal fields for additional info that should still be shown
                musicCard.fields = [
                    {
                        name: 'Volume',
                        value: `${player.volume}%`,
                        inline: true
                    },
                    {
                        name: 'Filter',
                        value: activeFilter,
                        inline: true
                    },
                    {
                        name: 'Loop',
                        value: getLoopModeName(player.loop),
                        inline: true
                    }
                ];
                
                reply = { embeds: [musicCard] };
            }
            
            // Create buttons for the nowplaying command
            // Button row with essential controls
            const nowPlayingRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pauseresume')
                        .setLabel('Pause/Resume')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('replay')
                        .setLabel('Replay')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('skip')
                        .setLabel('Skip')
                        .setStyle(ButtonStyle.Secondary)
                );

            // Add additional control buttons
            const controlsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('shuffle')
                        .setLabel('Shuffle')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('stop')
                        .setLabel('Stop')
                        .setStyle(ButtonStyle.Danger)
                );
                
            // Create a dropdown menu for filters
            const filtersDropdown = new StringSelectMenuBuilder()
                .setCustomId('filter_select')
                .setPlaceholder('Select a filter')
                .addOptions([
                    {
                        label: 'No Filter',
                        description: 'Remove all filters',
                        value: 'none'
                    },
                    {
                        label: 'Bass Boost',
                        description: 'Enhance the bass frequencies',
                        value: 'bassboost'
                    },
                    {
                        label: 'Nightcore',
                        description: 'Faster with tremolo effect',
                        value: 'nightcore'
                    },
                    {
                        label: 'Vaporwave',
                        description: 'Slowed down effect',
                        value: 'vaporwave'
                    },
                    {
                        label: '8D Audio',
                        description: 'Spatial audio effect',
                        value: '8d'
                    }
                ]);
                
            const filtersDropdownRow = new ActionRowBuilder()
                .addComponents(filtersDropdown);
                
            // Add components to the reply
            reply.components = [filtersDropdownRow, nowPlayingRow, controlsRow];
            
            // Reply with the music card and controls
            await interaction.reply(reply);
        } catch (error) {
            console.error("Error in nowplaying command:", error);
            return interaction.reply({ embeds: [errorEmbed('An error occurred while getting the now playing information!')], ephemeral: true });
        }
    }
};

// Helper function to get loop mode display name
function getLoopModeName(loopMode) {
    switch (loopMode) {
        case 'none': return 'Off';
        case 'track': return 'Current Track';
        case 'queue': return 'Queue';
        default: return 'Off';
    }
}


