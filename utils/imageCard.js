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
        sourceIcon = null,
        sourceName = 'Unknown Source',
        requester = 'Unknown',
        loopMode = 'none',             // Loop mode: none, track, queue
        queueSize = 0,                 // Number of tracks in queue
        backgroundColor = '#36393f'     // Discord dark theme color
    } = options;

    // Canvas settings
    const WIDTH = 800;
    const HEIGHT = 300;
    const THUMBNAIL_SIZE = 180;
    const PROGRESS_BAR_WIDTH = 480;
    const PROGRESS_BAR_HEIGHT = 10;
    const BORDER_RADIUS = 15;
    
    // Create canvas
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Add overall rounded corners mask
    ctx.save();
    roundedRect(ctx, 0, 0, WIDTH, HEIGHT, BORDER_RADIUS);
    ctx.clip();
    
    // Gradient background for more modern look
    const backgroundGradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    backgroundGradient.addColorStop(0, '#2b2d42');  // Deep blue-black
    backgroundGradient.addColorStop(1, '#1d1e2c');  // Darker variation
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Add a subtle pattern overlay
    ctx.fillStyle = 'rgba(37, 38, 58, 0.7)';
    for (let i = 0; i < WIDTH; i += 20) {
        for (let j = 0; j < HEIGHT; j += 20) {
            if ((i + j) % 40 === 0) {
                ctx.fillRect(i, j, 10, 10);
            }
        }
    }
    
    // Left accent bar with gradient
    const accentGradient = ctx.createLinearGradient(0, 0, 10, HEIGHT);
    accentGradient.addColorStop(0, '#5865F2');  // Discord blue
    accentGradient.addColorStop(0.5, '#4752C4');  // Mid-tone
    accentGradient.addColorStop(1, '#3b43a8');  // Darker blue
    ctx.fillStyle = accentGradient;
    ctx.fillRect(0, 0, 10, HEIGHT);
    ctx.restore();
    
    try {
        // Load and draw thumbnail
        let thumbImage;
        if (thumbnail) {
            try {
                // Safe fallback for thumbnail loading
                thumbImage = await safeLoadImage(thumbnail);
            } catch (err) {
                console.error('Failed to load thumbnail:', err);
                // Use a default music icon if the thumbnail fails
                thumbImage = await createDefaultThumbnail(THUMBNAIL_SIZE);
            }
        } else {
            thumbImage = await createDefaultThumbnail(THUMBNAIL_SIZE);
        }
        
        // Draw thumbnail with rounded corners at right side (to match screenshot)
        const thumbnailX = WIDTH - THUMBNAIL_SIZE - 40;
        const thumbnailY = 40;
        
        ctx.save();
        roundedRect(ctx, thumbnailX, thumbnailY, THUMBNAIL_SIZE, THUMBNAIL_SIZE, 10);
        ctx.clip();
        ctx.drawImage(thumbImage, thumbnailX, thumbnailY, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
        ctx.restore();
        
        // Draw "Now Playing" header
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px Arial';
        ctx.fillText('🎵 Now Playing', 40, 50);
        
        // Draw title with wrapping
        const titleLines = wrapText(ctx, title, WIDTH - THUMBNAIL_SIZE - 120, 'bold 22px Arial');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Arial';
        titleLines.forEach((line, i) => {
            ctx.fillText(line, 40, 90 + (i * 30));
        });
        
        // Draw artist in a lighter color
        ctx.fillStyle = '#bbbbbb';
        ctx.font = '18px Arial';
        ctx.fillText(artist, 40, 90 + (titleLines.length * 30) + 10);
        
        // Progress bar section
        const progressY = 150 + (titleLines.length * 15);
        
        if (!isStream) {
            // Progress bar background with glowing effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            roundedRect(ctx, 40, progressY, PROGRESS_BAR_WIDTH, PROGRESS_BAR_HEIGHT, PROGRESS_BAR_HEIGHT / 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Calculate progress percentage safely
            const progressPercentage = duration > 0 ? Math.min(progress / duration, 1) : 0;
            
            // Create progress bar gradient for a cooler look
            const progressGradient = ctx.createLinearGradient(40, 0, 40 + PROGRESS_BAR_WIDTH, 0);
            progressGradient.addColorStop(0, '#4961E8');  // Start with a brighter blue
            progressGradient.addColorStop(0.5, '#5865F2'); // Discord blue in middle
            progressGradient.addColorStop(1, '#7289DA');  // End with a lighter shade
            
            // Draw glowing progress bar
            if (progressPercentage > 0) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = 'rgba(88, 101, 242, 0.6)';
                ctx.fillStyle = progressGradient;
                roundedRect(ctx, 
                    40, 
                    progressY, 
                    Math.max(PROGRESS_BAR_WIDTH * progressPercentage, PROGRESS_BAR_HEIGHT), // Ensure minimum width for small values
                    PROGRESS_BAR_HEIGHT, 
                    PROGRESS_BAR_HEIGHT / 2
                );
                ctx.fill();
                ctx.shadowBlur = 0;
            }
            
            // Progress text below progress bar
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Arial';
            const progressText = `${formatDuration(progress)} / ${formatDuration(duration)}`;
            ctx.fillText(progressText, 40, progressY + 30);
            
            // Percentage next to progress text
            ctx.fillStyle = '#bbbbbb';
            ctx.fillText(`(${Math.floor(progressPercentage * 100)}%)`, 40 + ctx.measureText(progressText).width + 10, progressY + 30);
        } else {
            // Live stream display - using emoji instead of red dot
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Arial';
            ctx.fillText('🎬 LIVE STREAM', 40, progressY + 15);
        }
        
        // Information section - column 1 (with proper spacing)
        const infoY = progressY + 60;
        ctx.fillStyle = '#a0a0a0';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('Requested by:', 23, infoY);  // Added colon for clarity
        ctx.fillText('Source:', 23, infoY + 40);  // Added colon for consistency
        ctx.fillText('Duration:', 23, infoY + 80);  // Added colon for consistency
        
        // Information values - column 1
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        // Position username directly after the label with proper spacing
        ctx.fillText(requester, 130, infoY);
        ctx.fillText(sourceName, 130, infoY + 40);  // Aligned with "Requested by" value
        ctx.fillText(isStream ? 'LIVE' : formatDuration(duration), 130, infoY + 80);  // Aligned with other values
        
        // Information section - column 2
        ctx.fillStyle = '#a0a0a0';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('Volume', 300, infoY);
        ctx.fillText('Loop Mode', 300, infoY + 40);
        ctx.fillText('Queue', 300, infoY + 80);
        
        // Information values - column 2
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.fillText(`${volume}%`, 420, infoY);
        ctx.fillText(getLoopModeName(loopMode), 420, infoY + 40);
        ctx.fillText(`${queueSize} track${queueSize !== 1 ? 's' : ''}`, 420, infoY + 80);
        
        // Enhanced source icon based on the platform - positioned near source text
        const iconY = infoY + 40; // Align with the "Source" text row
        const sourceIconSize = 14;
        
        // Create a glowing source icon
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = getSourceColor(sourceName.toLowerCase());
        
        // Background circle for the icon
        ctx.fillStyle = getSourceColor(sourceName.toLowerCase());
        ctx.beginPath();
        ctx.arc(140, iconY, sourceIconSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Add platform-specific icon or logo
        ctx.fillStyle = "#FFFFFF";
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw platform-specific symbol with correct vertical alignment
        ctx.textBaseline = 'middle'; // Ensure text is vertically centered
        
        switch(sourceName.toLowerCase()) {
            case 'youtube':
                // Use music note icon instead of YouTube triangle
                ctx.fillText('♪', 140, iconY);
                break;
            case 'spotify':
                ctx.fillText('♫', 140, iconY);
                break;
            case 'soundcloud':
                ctx.fillText('☁', 140, iconY);
                break;
            case 'twitch':
                ctx.fillText('T', 140, iconY);
                break;
            default:
                ctx.fillText('♪', 140, iconY);
        }
        
        ctx.restore();
        
        // Convert to buffer and return
        return canvas.toBuffer('image/jpeg', { quality: 0.95 });
    } catch (error) {
        console.error('Error generating music card:', error);
        
        // Return a simple error card
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('Error generating music card', 50, 125);
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
            // Check for redirection
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // If redirected, recursively follow the redirect
                return fetchImage(res.headers.location)
                    .then(resolve)
                    .catch(reject);
            }
            
            // Check for successful status code
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP error ${res.statusCode}`));
            }
            
            // Collect data chunks
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            
            // Once all data is received, resolve with the complete buffer
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        
        // Handle request errors
        req.on('error', reject);
        
        // End the request
        req.end();
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
    
    // Create a more modern background gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#5865F2');  // Discord blue
    gradient.addColorStop(0.5, '#4752C4'); // Mid-tone
    gradient.addColorStop(1, '#404EED');  // Slightly lighter blue
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Add subtle pattern for texture - similar to the main card
    ctx.fillStyle = 'rgba(37, 38, 58, 0.3)';
    for (let i = 0; i < size; i += 20) {
        for (let j = 0; j < size; j += 20) {
            if ((i + j) % 40 === 0) {
                ctx.fillRect(i, j, 10, 10);
            }
        }
    }
    
    // Circle background for the music note
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/3, 0, Math.PI * 2);
    ctx.fill();
    
    // Music note icon with glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = `bold ${size/2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♪', size/2, size/2);
    
    // Add decorative circular accent
    ctx.shadowBlur = 0;
    ctx.lineWidth = 4;
    
    // Inner glowing circle
    const innerGradient = ctx.createRadialGradient(
        size/2, size/2, size/6,
        size/2, size/2, size/2.5
    );
    innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
    
    ctx.strokeStyle = innerGradient;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2.8, 0, Math.PI * 2);
    ctx.stroke();
    
    // Outer accent ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2.2, 0, Math.PI * 2);
    ctx.stroke();
    
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
    switch (source.toLowerCase()) {
        case 'youtube': return '#FF0000';  // YouTube red
        case 'spotify': return '#1DB954';  // Spotify green
        case 'soundcloud': return '#FF7700';  // SoundCloud orange
        case 'twitch': return '#6441A4';  // Twitch purple
        default: return '#5865F2';  // Discord blue
    }
}

module.exports = {
    generateMusicCard,
    saveMusicCard,
    createMusicCard
};