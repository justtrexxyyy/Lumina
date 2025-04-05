module.exports = {
    /**
     * Creates a simplified music card format
     * @param {Object} track The track object
     * @param {Boolean} isPlaying Whether the track is currently playing
     * @returns {Object} Embed object for the music card
     */
    createMusicCard: (track, isPlaying = false) => {
        // Get the track duration
        const duration = track.isStream ? 'LIVE' : module.exports.formatDuration(track.length);
        
        // Create title text with playing indicator if needed
        const title = isPlaying ? 'Now Playing' : 'Track';
        
        // Format the description to show only track name, artist and duration
        const description = `**[${track.title}](${process.env.SUPPORT_SERVER || 'https://discord.gg/76W85cu3Uy'})**\n${track.author} • \`${duration}\`${track.requester ? ` • <@${track.requester.id}>` : ''}`;
        
        // Get the embed from utils/embeds.js
        const { createEmbed } = require('./embeds');
        
        // Get thumbnail at the perfect size for Discord mobile (square with rounded corners)
        // Looking at the example screenshots, the thumbnails need to be square with rounded corners
        let thumbnail = track.thumbnail;
        
        // For YouTube thumbnails, use maxresdefault and modify dimensions for square format
        if (thumbnail && thumbnail.includes('youtube.com')) {
            // Force maxresdefault for high quality and modify dimensions for square format
            if (thumbnail.includes('i.ytimg.com')) {
                const videoId = thumbnail.match(/\/vi\/([a-zA-Z0-9_-]+)\//)?.[1];
                if (videoId) {
                    // Use maxresdefault for best quality, Discord will handle resizing
                    thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                }
            }ners
            // This matches exactly what we see in the screenshots
            if (thumbnail.includes('i.ytimg.com')) {
                // For YouTube image server thumbnails, use consistent pattern
                let videoId = '';
                
                // Extract video ID from thumbnail URL
                const match = thumbnail.match(/\/vi\/([a-zA-Z0-9_-]+)\//);
                if (match && match[1]) {
                    videoId = match[1];
                    // Rebuild URL with square thumbnail format for Discord mobile
                    thumbnail = `https://i.ytimg.com/vi/${videoId}/default.jpg`;
                }
            } else {
                // Otherwise replace any quality parameter with default
                thumbnail = thumbnail.replace(/\/(maxresdefault|sddefault|hqdefault|mqdefault)\.jpg/, '/default.jpg');
            }
        }
        
        // Use a cleaner embed optimized for mobile viewing with SoundCloud-like thumbnail size
        return createEmbed({
            title: title,
            description: description,
            thumbnail: thumbnail
        });
    },
    
    /**
     * Format milliseconds into a readable time string
     * @param {Number} ms Duration in milliseconds
     * @returns {String} Formatted time string
     */
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
    
    /**
     * Format milliseconds into a long form duration string
     * @param {Number} ms Duration in milliseconds
     * @returns {String} Formatted duration string
     */
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
    
    /**
     * Create a progress bar
     * @param {Number} current Current position
     * @param {Number} total Total duration
     * @param {Number} size Bar size
     * @returns {String} Progress bar string
     */
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
    
    /**
     * Format a queue page
     * @param {Array} tracks Array of tracks
     * @param {Number} page Current page number
     * @param {Number} tracksPerPage Tracks to display per page
     * @returns {String} Formatted queue page
     */
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
