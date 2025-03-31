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
    const loopMode = options.loopMode ? getLoopModeIcon(options.loopMode) : '❌';
    const queueSize = options.queueSize !== undefined ? options.queueSize : 0;
    
    // Format progress information
    let progressBar = '';
    let progressPercentage = 0;
    let progressInfo = '';
    
    if (isStream) {
        progressInfo = '🔴 LIVE';
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
╭──────────── ${sourceIcon} Audic Music Player ────────────╮
│                                                    │
│  ${wrapTitle(title)}  │
│  ${limitLength(`<:artist:1234567890123456789> ${author}`, 50)}  │
${isStream ? '│                                                    │' : `│  ${progressBar}  │`}
${isStream ? '│                    <:live:1234567890123456789> LIVE                     │' : `│  ${progressInfo.padStart(7).padEnd(16)} • ${progressPercentage}%               │`}
│                                                    │
│  <:duration:1234567890123456789> ${isStream ? 'LIVE' : formatTimeStamp(duration)}  <:volume:1234567890123456789> ${volume}%  <:user:1234567890123456789> ${limitLength(requester, 15)}  │
│  ${loopMode} Loop  <:queue:1234567890123456789> ${queueSize} in queue  ${sourceIcon} ${sourcePlatform}         │
╰────────────────────────────────────────────────────╯
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
    let progressBar = isStream ? '<:live:1234567890123456789> LIVE' : createTextProgressBar(position, duration, 20);
    let progressText = isStream ? 'LIVE' : `${formatTimeStamp(position)} / ${formatTimeStamp(duration)}`;
    
    const sourceIcon = track.uri ? getSourceIcon(getSourceFromUrl(track.uri)) : '<:music:1234567890123456789>';
    
    // Build the mini card with improved styling
    return `\`\`\`
╭────── ${sourceIcon} Now Playing ──────╮
│ ${title.padEnd(30)} │
│ <:artist:1234567890123456789> ${artist.padEnd(28)} │
${isStream ? '│ <:live:1234567890123456789> LIVE                     │' : `│ ${progressBar} │`}
${isStream ? '│                            │' : `│ ${progressText.padStart(28)} │`}
╰───────────────────────────╯
\`\`\``;
}

// Helper functions
function createTextProgressBar(current, total, length = 20) {
    const percentage = Math.min(100, (current / total) * 100);
    const filledLength = Math.round((length * percentage) / 100);
    
    let bar = '▰'.repeat(filledLength);
    bar += '▱'.repeat(length - filledLength);
    
    return bar;
}

function formatTimeStamp(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getSourceIcon(source) {
    switch (source.toLowerCase()) {
        case 'youtube': return '<:youtube:1234567890123456789>';
        case 'spotify': return '<:spotify:1234567890123456789>';
        case 'soundcloud': return '<:soundcloud:1234567890123456789>';
        case 'twitch': return '<:twitch:1234567890123456789>';
        default: return '<:music:1234567890123456789>';
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
    switch (loopMode) {
        case 'track': return '<:looptrack:1234567890123456789>';
        case 'queue': return '<:loopqueue:1234567890123456789>';
        case 'none': 
        default: return '<:loopoff:1234567890123456789>';
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