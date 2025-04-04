module.exports = {
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
