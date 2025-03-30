const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const { formatDuration } = require('./formatters');
const http = require('http');
const https = require('https');

/**
 * Generate a music card image
 * @param {Object} options - Card generation options
 * @returns {Promise<Buffer>} - Image buffer
 */
async function generateMusicCard(options = {}) {
    const {
        title = 'Unknown Title',
        artist = 'Unknown Artist',
        thumbnail = null,
        progress = 0,                  // Current position in ms
        duration = 0,                  // Total duration in ms
        isStream = false,
        volume = 100,
        sourceName = 'Unknown Source',
        requester = 'Unknown',
        loopMode = 'none',             // Loop mode: none, track, queue
        queueSize = 0                  // Number of tracks in queue
    } = options;

    // Canvas settings - match Discord dark theme
    const WIDTH = 640;  // Slightly reduced width for better display on mobile
    const HEIGHT = 240; // Reduced height for a more compact card
    const THUMBNAIL_SIZE = 160;
    const PROGRESS_BAR_WIDTH = 400;
    const PROGRESS_BAR_HEIGHT = 8;  // Slimmer progress bar
    const BORDER_RADIUS = 10;
    
    // Create canvas
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    
    try {
        // Create background with Discord dark theme color
        ctx.fillStyle = '#2b2d31'; // Discord dark theme background
        roundedRect(ctx, 0, 0, WIDTH, HEIGHT, BORDER_RADIUS);
        ctx.fill();
        
        // Add subtle gradient overlay
        const backgroundGradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
        backgroundGradient.addColorStop(0, 'rgba(47, 49, 54, 0.6)');   // Discord darker gray
        backgroundGradient.addColorStop(1, 'rgba(32, 34, 37, 0.6)');   // Discord darkest gray
        ctx.fillStyle = backgroundGradient;
        roundedRect(ctx, 0, 0, WIDTH, HEIGHT, BORDER_RADIUS);
        ctx.fill();
        
        // Left accent bar with Discord brand color
        ctx.fillStyle = '#5865F2';  // Discord brand blue
        roundedRect(ctx, 0, 0, 6, HEIGHT, 0);
        ctx.fill();
        
        // Load and draw thumbnail
        let thumbImage;
        try {
            thumbImage = await safeLoadImage(thumbnail || '');
        } catch (err) {
            thumbImage = await createDefaultThumbnail(THUMBNAIL_SIZE);
        }
        
        // Draw thumbnail on right side with rounded corners
        const thumbnailX = WIDTH - THUMBNAIL_SIZE - 20;
        const thumbnailY = (HEIGHT - THUMBNAIL_SIZE) / 2;
        
        // Draw thumbnail with shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;
        roundedRect(ctx, thumbnailX, thumbnailY, THUMBNAIL_SIZE, THUMBNAIL_SIZE, 8);
        ctx.clip();
        ctx.drawImage(thumbImage, thumbnailX, thumbnailY, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
        ctx.restore();
        
        // Title area - left side
        const textAreaWidth = WIDTH - THUMBNAIL_SIZE - 60; // Space for text
        
        // Draw title with wrapping
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        const titleLines = wrapText(ctx, title, textAreaWidth, 'bold 18px Arial');
        
        // Adjust Y position based on number of title lines
        let yOffset = 0;
        if (titleLines.length === 1) {
            yOffset = 10; // Move everything down a bit if title is short
        }
        
        titleLines.forEach((line, i) => {
            ctx.fillText(line, 25, 50 + yOffset + (i * 24));
        });
        
        // Draw artist
        ctx.fillStyle = '#b9bbbe'; // Discord muted text color
        ctx.font = '16px Arial';
        ctx.fillText(artist, 25, 50 + yOffset + (titleLines.length * 24) + 6);
        
        // Draw progress bar 
        const progressY = 110 + yOffset + (Math.max(0, titleLines.length - 2) * 20);
        
        if (!isStream) {
            // Progress bar background
            ctx.fillStyle = 'rgba(79, 84, 92, 0.3)'; // Discord muted background
            roundedRect(ctx, 25, progressY, PROGRESS_BAR_WIDTH, PROGRESS_BAR_HEIGHT, PROGRESS_BAR_HEIGHT / 2);
            ctx.fill();
            
            // Calculate progress percentage
            const progressPercentage = duration > 0 ? Math.min(progress / duration, 1) : 0;
            
            // Progress bar fill
            if (progressPercentage > 0) {
                ctx.fillStyle = '#5865F2'; // Discord brand blue
                roundedRect(ctx, 
                    25, 
                    progressY, 
                    Math.max(PROGRESS_BAR_WIDTH * progressPercentage, PROGRESS_BAR_HEIGHT), 
                    PROGRESS_BAR_HEIGHT, 
                    PROGRESS_BAR_HEIGHT / 2
                );
                ctx.fill();
            }
            
            // Progress time text
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px Arial';
            const progressText = `${formatDuration(progress)} / ${formatDuration(duration)}`;
            ctx.fillText(progressText, 25, progressY + 24);
            
            // Percentage display
            ctx.fillStyle = '#b9bbbe';
            ctx.fillText(`(${Math.floor(progressPercentage * 100)}%)`, 
                25 + ctx.measureText(progressText).width + 10, progressY + 24);
        } else {
            // Live stream indicator
            ctx.fillStyle = '#ed4245'; // Discord red for live indicator
            ctx.beginPath();
            ctx.arc(35, progressY + 10, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Arial';
            ctx.fillText('LIVE STREAM', 50, progressY + 14);
        }
        
        // Bottom info section
        const infoY = progressY + 45;
        const column1X = 25;
        const column2X = 200;
        const column3X = 350;
        
        // Column headers - light gray
        ctx.fillStyle = '#72767d'; // Discord muted text
        ctx.font = 'bold 13px Arial';
        
        // Column 1
        ctx.fillText('Requested by', column1X, infoY);
        // Column 2
        ctx.fillText('Source', column2X, infoY);
        ctx.fillText('Volume', column2X, infoY + 24);
        // Column 3
        ctx.fillText('Loop Mode', column3X, infoY);
        
        // Column values - white
        ctx.fillStyle = '#ffffff';
        ctx.font = '13px Arial';
        
        // Column 1 values
        ctx.fillText(requester, column1X, infoY + 24);
        
        // Column 2 values - with source icon
        // Source icon (before text)
        const sourceIconY = infoY + 12;
        const iconSize = 14;
        
        // Display all sources the same way with normal text style and no icons
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '14px Arial';
        
        // Draw source text in normal position
        ctx.fillText(sourceName, column2X, infoY + 12);
        
        // Volume value
        ctx.fillText(`${volume}%`, column2X, infoY + 36);
        
        // Column 3 values
        ctx.fillText(getLoopModeName(loopMode), column3X, infoY + 12);
        
        // Convert to buffer and return
        return canvas.toBuffer('image/jpeg', { quality: 0.9 });
    } catch (error) {
        console.error('Error generating music card:', error);
        
        // Create a simple error fallback card
        ctx.fillStyle = '#2b2d31'; // Discord dark theme
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Error generating music card', WIDTH/2, HEIGHT/2);
        
        return canvas.toBuffer('image/jpeg');
    }
}

/**
 * Save music card to file system
 * @param {Buffer} buffer - Image buffer
 * @param {string} filename - File name
 * @returns {Promise<string>} - Path to saved file
 */
async function saveMusicCard(buffer, filename = 'music_card.jpg') {
    // Ensure directory exists
    const directory = path.join(__dirname, '../temp');
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
    
    const filepath = path.join(directory, filename);
    
    return new Promise((resolve, reject) => {
        fs.writeFile(filepath, buffer, (err) => {
            if (err) {
                console.error('Error saving music card:', err);
                reject(err);
            } else {
                resolve(filepath);
            }
        });
    });
}

/**
 * Create a music card and return the file path
 * @param {Object} track - Track object
 * @param {number} position - Current playback position
 * @param {number} volume - Current volume
 * @param {string} sourceName - Source platform name
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Path to the generated music card image
 */
async function createMusicCard(track, position = 0, volume = 100, sourceName = 'Unknown', options = {}) {
    if (!track) {
        throw new Error('No track provided');
    }
    
    const cardOptions = {
        title: track.title || 'Unknown Track',
        artist: track.author || 'Unknown Artist',
        thumbnail: track.thumbnail || null,
        progress: position,
        duration: track.length || 0,
        isStream: track.isStream || false,
        volume: volume,
        sourceName: sourceName,
        requester: options.requester ? options.requester.username || 'Unknown' : 'Unknown',
        loopMode: options.loopMode || 'none',
        queueSize: options.queueSize || 0
    };
    
    const buffer = await generateMusicCard(cardOptions);
    const filename = `music_card_${Date.now()}.jpg`;
    const filepath = await saveMusicCard(buffer, filename);
    
    return filepath;
}

// Helper functions
function truncateText(ctx, text, maxWidth) {
    if (!text) return 'Unknown';
    
    if (ctx.measureText(text).width <= maxWidth) {
        return text;
    }
    
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }
    
    return truncated + '...';
}

/**
 * Wraps text to fit within a specified width
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum width
 * @param {string} font - Font to use for measuring
 * @returns {string[]} Array of lines
 */
function wrapText(ctx, text, maxWidth, font) {
    if (!text) return ['Unknown'];
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    // Set font for measuring
    ctx.font = font;
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + word).width;
        
        if (width < maxWidth || currentLine === '') {
            currentLine += (currentLine === '' ? '' : ' ') + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    
    if (currentLine !== '') {
        lines.push(currentLine);
    }
    
    // Limit to 2 lines maximum and add ellipsis if needed
    if (lines.length > 2) {
        lines.length = 2;
        lines[1] = truncateText(ctx, lines[1], maxWidth - ctx.measureText('...').width) + '...';
    }
    
    return lines;
}

function roundedRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    return ctx;
}

/**
 * Handle thumbnail loading with better error handling
 * @param {string} url - Image URL
 * @returns {Promise<Canvas.Image>} - Loaded image
 */
async function safeLoadImage(url) {
    try {
        // Try the direct loading first (for local files and most URLs)
        return await loadImage(url);
    } catch (err) {
        try {
            // If direct loading fails, try fetching with native http/https
            console.log(`Direct image loading failed, trying with http/https: ${url}`);
            
            // Fetch image with native http/https
            const buffer = await fetchImage(url);
            return await loadImage(buffer);
        } catch (fetchErr) {
            console.error('Fetch attempt also failed:', fetchErr);
            // If all attempts fail, create a default thumbnail
            return await createDefaultThumbnail(180);
        }
    }
}

/**
 * Fetch an image using native http/https modules
 * @param {string} url - URL to fetch
 * @returns {Promise<Buffer>} - Buffer containing the image data
 */
function fetchImage(url) {
    return new Promise((resolve, reject) => {
        // Determine which module to use based on URL protocol
        const client = url.startsWith('https') ? https : http;
        
        // Set request options with a user agent
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };
        
        // Make the request
        const req = client.get(url, options, (res) => {
            // Check for redirect
            if (res.statusCode === 301 || res.statusCode === 302) {
                if (res.headers.location) {
                    return resolve(fetchImage(res.headers.location));
                }
            }
            
            // Check if the response is successful
            if (res.statusCode !== 200) {
                return reject(new Error(`Request failed with status code ${res.statusCode}`));
            }
            
            // Stream the response body
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        
        // Handle errors
        req.on('error', (err) => {
            console.error('Error fetching image:', err);
            reject(err);
        });
        
        // Set timeout
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });
    });
}

/**
 * Create a default thumbnail with a music note
 * @param {number} size - Size of the thumbnail
 * @returns {Promise<Canvas.Canvas>} - Canvas object
 */
async function createDefaultThumbnail(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Draw gradient background
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#5865F2');  // Discord blue
    gradient.addColorStop(1, '#404EED');  // Discord purple
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Draw music note
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = `bold ${size/2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♪', size/2, size/2);
    
    return canvas;
}

/**
 * Get human-readable loop mode name
 * @param {string} loopMode - Loop mode (none, track, queue)
 * @returns {string} - Display name
 */
function getLoopModeName(loopMode) {
    switch (loopMode) {
        case 'none': return 'Off';
        case 'track': return 'Current Track';
        case 'queue': return 'Queue';
        default: return 'Off';
    }
}

/**
 * Get color for source icon
 * @param {string} source - Source name
 * @returns {string} - Color hex
 */
function getSourceColor(source) {
    switch(source) {
        case 'youtube': return '#FF0000';  // YouTube red
        case 'spotify': return '#1DB954';  // Spotify green
        case 'soundcloud': return '#FF7700';  // SoundCloud orange
        case 'twitch': return '#9146FF';  // Twitch purple
        default: return '#5865F2';  // Discord blue
    }
}

module.exports = {
    generateMusicCard,
    saveMusicCard,
    createMusicCard
};