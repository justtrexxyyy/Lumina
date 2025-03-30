const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embeds');
const { formatDuration, createProgressBar } = require('../utils/formatters');
const { createMusicCard } = require('../utils/imageCard');
const config = require('../config');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show currently playing track'),
    
    async execute(interaction) {
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
        
        // Get position and create progress bar
        const position = player.position;
        const duration = current.length;
        const isStream = current.isStream;
        const positionFormatted = formatDuration(position);
        const durationFormatted = isStream ? 'LIVE' : formatDuration(duration);
        
        // Get source platform
        const sourcePlatform = getSourcePlatform(current.uri);
        
        // Defer the reply while we generate the image
        await interaction.deferReply();
        
        try {
            // Generate image-based music card
            const musicCardPath = await createMusicCard(current, position, player.volume, sourcePlatform, {
                requester: current.requester,
                loopMode: player.loop,
                queueSize: player.queue.length
            });
            
            // Create attachment from the generated image
            const attachment = new AttachmentBuilder(musicCardPath, { name: 'music_card.jpg' });
            
            // Create buttons for player control
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('np_previous')
                        .setLabel('⏮️')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(player.paused ? 'np_resume' : 'np_pause')
                        .setLabel(player.paused ? '▶️' : '⏸️')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('np_skip')
                        .setLabel('⏭️')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('np_stop')
                        .setLabel('⏹️')
                        .setStyle(ButtonStyle.Danger)
                );
            
            // Minimal embed with just the image card
            const npEmbed = {
                image: {
                    url: 'attachment://music_card.jpg'
                },
                color: parseInt(config.embedColor.replace('#', ''), 16)
            };
            
            // Edit the deferred reply with the embed, attachment, and buttons
            await interaction.editReply({ 
                embeds: [npEmbed],
                files: [attachment],
                components: [row]
            });
            
            // Clean up the temporary file after sending
            fs.unlink(musicCardPath, (err) => {
                if (err) console.error('Error removing temporary music card file:', err);
            });
            
            // Create a collector for button interactions
            const filter = i => 
                i.customId.startsWith('np_') && 
                i.user.id === interaction.user.id;
            
            const collector = interaction.channel.createMessageComponentCollector({ 
                filter, 
                time: 60000 // 1 minute timeout
            });
            
            collector.on('collect', async i => {
                // Button handling
                switch (i.customId) {
                    case 'np_pause':
                        if (!player.paused) player.pause(true);
                        await i.update({ 
                            components: [updateButtonRow(row, 'np_pause', 'np_resume', '▶️', ButtonStyle.Success)]
                        });
                        break;
                    case 'np_resume':
                        if (player.paused) player.pause(false);
                        await i.update({ 
                            components: [updateButtonRow(row, 'np_resume', 'np_pause', '⏸️', ButtonStyle.Primary)]
                        });
                        break;
                    case 'np_skip':
                        player.skip();
                        await i.update({ content: '⏭️ Skipped to next track!', components: [] });
                        collector.stop();
                        break;
                    case 'np_stop':
                        player.destroy();
                        await i.update({ content: '⏹️ Playback stopped!', components: [] });
                        collector.stop();
                        break;
                    case 'np_previous':
                        // This would require implementing a previous track feature
                        await i.reply({ content: 'Previous track feature not implemented yet!', ephemeral: true });
                        break;
                }
            });
            
            collector.on('end', () => {
                // Remove buttons after timeout
                interaction.editReply({ components: [] }).catch(console.error);
            });
            
        } catch (error) {
            console.error('Error generating music card:', error);
            
            // Fallback to simpler embed without the image card
            const progressBar = isStream ? 'LIVE' : createProgressBar(position, duration);
            
            // Create minimal fallback fields with simplified layout
            const fields = [
                {
                    name: 'Track Info',
                    value: `**Duration:** ${isStream ? '🎬 LIVE' : durationFormatted}\n**Source:** ${sourcePlatform}\n**Volume:** ${player.volume}%`,
                    inline: true
                },
                {
                    name: 'Status',
                    value: `**Position:** ${isStream ? 'N/A' : positionFormatted}\n**Loop:** ${getLoopModeName(player.loop)}\n**Queue:** ${player.queue.length} tracks`,
                    inline: true
                }
            ];
            
            const npEmbed = {
                title: `${config.emojis.nowPlaying} Now Playing`,
                description: `${config.emojis.music} [${current.title}](${current.uri})`,
                fields: fields,
                thumbnail: {
                    url: current.thumbnail || config.botLogo
                },
                color: parseInt(config.embedColor.replace('#', ''), 16)
            };
            
            // Edit the deferred reply with the fallback embed
            await interaction.editReply({ 
                embeds: [npEmbed]
            });
        }
    },
};

// Helper functions
function getSourcePlatform(uri) {
    if (uri.includes('youtube.com') || uri.includes('youtu.be')) {
        return 'YouTube';
    } else if (uri.includes('spotify.com')) {
        return 'Spotify';
    } else if (uri.includes('soundcloud.com')) {
        return 'SoundCloud';
    } else if (uri.includes('twitch.tv')) {
        return 'Twitch';
    } else {
        return 'Unknown';
    }
}

function getLoopModeName(loopMode) {
    switch (loopMode) {
        case 'none': return 'Off';
        case 'track': return 'Current Track';
        case 'queue': return 'Queue';
        default: return 'Off';
    }
}

/**
 * Update a button in the ActionRow
 * @param {ActionRowBuilder} row - The action row containing buttons
 * @param {string} oldId - The ID of the button to replace
 * @param {string} newId - The new ID for the button
 * @param {string} newLabel - The new label for the button
 * @param {ButtonStyle} newStyle - The new style for the button
 * @returns {ActionRowBuilder} Updated row
 */
function updateButtonRow(row, oldId, newId, newLabel, newStyle) {
    // Get components from the ActionRow
    const components = row.components;
    
    // Find the button to update
    const buttonIndex = components.findIndex(btn => btn.data.custom_id === oldId);
    
    if (buttonIndex !== -1) {
        // Create a new button with updated properties
        const updatedButton = ButtonBuilder.from(components[buttonIndex])
            .setCustomId(newId)
            .setLabel(newLabel)
            .setStyle(newStyle);
        
        // Replace the old button with the updated one
        components[buttonIndex] = updatedButton;
    }
    
    // Create a new ActionRow with the updated components
    return new ActionRowBuilder().addComponents(components);
}
