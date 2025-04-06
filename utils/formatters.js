const { createEmbed } = require('./embeds');

const { createCanvas, loadImage } = require('canvas');
const path = require('path');

module.exports = {
    createMusicCard: async (track, isPlaying = false) => {
        const canvas = createCanvas(800, 200);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#2f3136';
        ctx.fillRect(0, 0, 800, 200);

        try {
            // Load and draw thumbnail
            const thumbnail = await loadImage(track.thumbnail);
            ctx.drawImage(thumbnail, 20, 20, 160, 160);

            // Text styling
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Arial';

            // Draw title (with truncation if needed)
            let title = track.title;
            if (title.length > 40) title = title.substring(0, 37) + '...';
            ctx.fillText(title, 200, 60);

            // Draw artist
            ctx.font = '20px Arial';
            ctx.fillStyle = '#b9bbbe';
            ctx.fillText(track.author, 200, 100);

            // Draw duration
            const duration = track.isStream ? 'LIVE' : module.exports.formatDuration(track.length);
            ctx.fillText(duration, 200, 140);

            // Draw playing status
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(isPlaying ? 'Now Playing' : 'Track', 680, 40);

            return canvas.toBuffer();
        } catch (error) {
            console.error('Error creating music card:', error);
            // Fallback to embed if image creation fails
            return createEmbed({
                title: isPlaying ? 'Now Playing' : 'Track',
                description: `**${track.title}**\n${track.author}\n\`${duration}\``,
                thumbnail: track.thumbnail
            });
        }
    },

    formatDuration: (ms) => {
        if (isNaN(ms) || ms <= 0) return '0:00';

        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        let result = '';
        if (hours > 0) {
            result += `${hours}:`;
            result += `${minutes.toString().padStart(2, '0')}:`;
        } else {
            result += `${minutes}:`;
        }
        result += `${seconds.toString().padStart(2, '0')}`;

        return result;
    },

    formatDurationLong: (ms) => {
        if (isNaN(ms) || ms <= 0) return '0 seconds';

        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        const parts = [];
        if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
        if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
        if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

        return parts.join(', ');
    },

    createProgressBar: (current, total, size = 15) => {
        if (isNaN(current) || isNaN(total)) return '';
        if (total <= 0) return '';

        const percentage = current / total;
        const progress = Math.round(size * percentage);
        const emptyProgress = size - progress;

        const progressText = '▓'.repeat(progress);
        const emptyProgressText = '░'.repeat(emptyProgress);

        return `[${progressText}${emptyProgressText}] (${Math.round(percentage * 100)}%)`;
    },

    formatQueuePage: (tracks, page = 1, tracksPerPage = 10) => {
        if (!tracks || !tracks.length) return 'No tracks in queue';

        const startIndex = (page - 1) * tracksPerPage;
        const endIndex = startIndex + tracksPerPage;
        const currentTracks = tracks.slice(startIndex, endIndex);

        let result = '';
        for (let i = 0; i < currentTracks.length; i++) {
            const track = currentTracks[i];
            const position = startIndex + i + 1;
            const duration = track.isStream ? 'LIVE' : module.exports.formatDuration(track.length);
            result += `**${position}.** [${track.title}](${track.uri}) \`[${duration}]\` | <@${track.requester.id}>\n`;
        }

        return result;
    }
};