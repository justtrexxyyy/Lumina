// Copy the section we want to modify with our changes
            // Check if user is in the same voice channel
            if (!member.voice.channel || member.voice.channel.id !== player.voiceId) {
                return interaction.reply({ 
                    content: interaction.customId === 'stop' 
                        ? 'You need to be in the same voice channel to stop playback.' 
                        : 'You must be in the same voice channel as the bot to use this!', 
                    ephemeral: true 
                });
            }