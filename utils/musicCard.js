/**
 * Music Card Generator Utility
 * Creates ASCII/text-based music cards for Discord embeds
 */

/**
 * Generate a decorative music card for the current track
 * @param {Object} track - The track object
 * @param {Number} position - Current playback position in ms
 * @param {Number} volume - Current volume level
 * @param {String} sourcePlatform - Source platform name
 * @param {Object} options - Additional options
 * @returns {String} - Formatted music card
 */
function generateMusicCard(track, position = 0, volume = 100, sourcePlatform = 'Unknown', options = {}) {
    if (!track) return 'No track information available';
    
    const isStream = track.isStream;
    const duration = track.length;
    const title = limitLength(track.title, 42);
    const author = track.author || 'Unknown Artist';
    const requester = options.requester ? options.requester.username || 'Unknown' : 'Unknown';
    const loopMode = options.loopMode ? getLoopModeIcon(options.loopMode) : 'Off';
    const queueSize = options.queueSize !== undefined ? options.queueSize : 0;
    
    // Format progress information
    let progressBar = '';
    let progressPercentage = 0;
    let progressInfo = '';
    
    if (isStream) {
        progressInfo = 'LIVE';
    } else {
        progressPercentage = Math.floor((position / duration) * 100);
        const posFormatted = formatTimeStamp(position);
        const durFormatted = formatTimeStamp(duration);
        progressInfo = `${posFormatted} / ${durFormatted}`;
        progressBar = createTextProgressBar(position, duration, 30);
    }
    
    // Create the card
    const sourceIcon = getSourceIcon(sourcePlatform);
    
    // Build the card template with improved styling
    return `\`\`\`
╔══════════════ ${sourceIcon} ══════════════╗
║                                          ║
║  ${wrapTitle(title)}  ║
║  ${limitLength(`${author}`, 50)}  ║
${isStream ? '║                                          ║' : `║  ${progressBar}  ║`}
${isStream ? '║             ♾️ LIVE STREAM              ║' : `║  ${progressInfo.padStart(7).padEnd(16)} • ${progressPercentage}%                     ║`}
║                                          ║
║  ${config.emojis.duration} ${isStream ? 'LIVE' : formatTimeStamp(duration)}  ${config.emojis.volume} ${volume}%  ${config.emojis.user} ${limitLength(requester, 12)}  ║
║  ${config.emojis.loop} ${loopMode}  ${config.emojis.queue} ${queueSize} tracks       ║
╚══════════════════════════════════════════╝
\`\`\``;
}

/**
 * Generate a mini music card variant
 * @param {Object} track - The track object
 * @param {Number} position - Current playback position in ms
 * @returns {String} - Formatted mini music card
 */
function generateMiniMusicCard(track, position = 0) {
    if (!track) return 'No track information available';
    
    const isStream = track.isStream;
    const duration = track.length;
    const title = limitLength(track.title, 30);
    const artist = track.author ? limitLength(track.author, 20) : 'Unknown Artist';
    
    // Format progress information
    let progressBar = isStream ? 'LIVE' : createTextProgressBar(position, duration, 20);
    let progressText = isStream ? 'LIVE' : `${formatTimeStamp(position)} / ${formatTimeStamp(duration)}`;
    
    const sourceIcon = track.uri ? getSourceIcon(getSourceFromUrl(track.uri)) : 'Music';
    
    const config = require('../config');
    
    // Build the mini card with improved styling
    return `\`\`\`
╔═══════ ${config.emojis.nowPlaying} Now Playing ═══════╗
║ ${title.padEnd(30)} ║
║ ${artist.padEnd(30)} ║
${isStream ? '║ ♾️ LIVE STREAM                    ║' : `║ ${progressBar} ║`}
${isStream ? '║                                   ║' : `║ ${progressText.padStart(28)} ║`}
╚═══════════════════════════════════╝
\`\`\``;
}

// Helper functions
function createTextProgressBar(current, total, length = 20) {
    const percentage = Math.min(100, (current / total) * 100);
    const filledLength = Math.round((length * percentage) / 100);
    
    // Using more visually appealing Unicode block characters
    let bar = '━'.repeat(filledLength);
    
    // Add position marker if not at start or end
    if (filledLength > 0 && filledLength < length) {
        bar = bar.substring(0, filledLength - 1) + '⭐' + '─'.repeat(length - filledLength);
    } else {
        bar += '─'.repeat(length - filledLength);
    }
    
    return bar;
}

function formatTimeStamp(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getSourceIcon(source) {
    const config = require('../config');
    
    switch (source.toLowerCase()) {
        case 'youtube':
            return config.emojis.youtube + ' YouTube';
        case 'spotify':
            return config.emojis.spotify + ' Spotify';
        case 'soundcloud':
            return config.emojis.soundcloud + ' SoundCloud';
        case 'twitch':
            return config.emojis.loading + ' Twitch';
        default:
            return config.emojis.music + ' ' + source.charAt(0).toUpperCase() + source.slice(1).toLowerCase();
    }
}

function limitLength(str, maxLength) {
    if (!str) return 'Unknown';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

function wrapTitle(title, maxLength = 45) {
    if (!title) return 'Unknown';
    
    if (title.length <= maxLength) {
        return title.padEnd(maxLength);
    }
    
    // First part on first line
    return title.substring(0, maxLength - 3) + '...';
}

function getLoopModeIcon(loopMode) {
    const config = require('../config');
    
    switch (loopMode) {
        case 'track': 
            return config.emojis.loopTrack + ' Track';
        case 'queue': 
            return config.emojis.loopQueue + ' Queue';
        case 'none': 
        default: 
            return config.emojis.loopOff + ' Off';
    }
}

function getSourceFromUrl(uri) {
    if (!uri) return 'Unknown';
    
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

module.exports = {
    generateMusicCard,
    generateMiniMusicCard
};