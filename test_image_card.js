const { createMusicCard } = require('./utils/imageCard');
const fs = require('fs');
const path = require('path');

// Enhanced mock track object with a variety of test cases
const mockTracks = [
    {
        title: 'Test Track Title with Normal Length',
        author: 'Test Artist',
        thumbnail: 'https://i.imgur.com/KoIfEYT.jpg', // Using a reliable Imgur image as fallback
        length: 180000, // 3 minutes in ms
        isStream: false,
        uri: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        requester: {
            id: '123456789',
            username: 'Test User'
        }
    },
    {
        title: 'Pistol Bole Gi | Masoom Sharma | Sheeenam Katholic | Kay D | Aarohi Raghav | New Haryanvi Song 2025',
        author: 'Haryanvi Hits',
        thumbnail: 'https://i.imgur.com/v3dvR1z.jpg', // Another reliable Imgur image
        length: 240000, // 4 minutes in ms
        isStream: false,
        uri: 'https://www.youtube.com/watch?v=sample1',
        requester: {
            id: '234567890',
            username: 'Unknownz'
        }
    },
    {
        title: 'Top 90 NoCopyRightSounds | Best of NCS | Most Viewed Songs | The Best of All Time | 2022',
        author: 'NCS Collection',
        thumbnail: 'https://i.imgur.com/XCWfCDZ.jpg', // NCS collection reliable image
        length: 19387000, // 5 hours, 23 minutes, 7 seconds
        isStream: false,
        uri: 'https://www.youtube.com/watch?v=sample2',
        requester: {
            id: '345678901',
            username: 'Unknownz'
        }
    },
    {
        title: 'KR$NA - Joota Japani | Official Music Video',
        author: 'Kr$na Official',
        thumbnail: 'https://i.imgur.com/cMOhY0w.jpg', // Hip-hop track image
        length: 160000, // 2 minutes 40 seconds
        isStream: false,
        uri: 'https://www.youtube.com/watch?v=sample3',
        requester: {
            id: '456789012',
            username: 'Unknownz'
        }
    },
    {
        title: 'Live Stream Test',
        author: 'Streaming Channel',
        thumbnail: 'https://i.imgur.com/JteMXS3.jpg', // Live stream thumbnail
        length: 0,
        isStream: true,
        uri: 'https://www.twitch.tv/example',
        requester: {
            id: '567890123',
            username: 'Stream Viewer'
        }
    }
];

// Test the image card generation
async function testImageCard() {
    console.log('Testing enhanced music card generation...');
    console.log('FIX VERIFICATION: YouTube logo should now be pointing right (horizontally)');
    console.log('FIX VERIFICATION: "Requested by" label now has proper spacing');
    
    // ASCII representation of what the fixed music card should look like
    console.log(`
    Music Card Layout (ASCII representation of fixed version):
    +------------------------------------------------+
    |  [Thumbnail]  | Title: Track Title             |
    |               | Artist: Artist Name            |
    |               |                                |
    |               | [===========O==========] 50%   |
    |               |                                |
    |               | Requested by: Username         |
    |               | Source: YouTube >              |
    |               | Duration: 3:00                 |
    |               |                                |
    |               | Volume: 100%                   |
    |               | Loop Mode: Off                 |
    |               | Queue: 5 tracks                |
    +------------------------------------------------+
    `);
    
    try {
        // Create directory for test output if it doesn't exist
        const outputDir = path.join(__dirname, 'test_output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Test different track scenarios
        for (let i = 0; i < mockTracks.length; i++) {
            const track = mockTracks[i];
            const trackType = track.isStream ? 'stream' : 'track';
            
            // For regular tracks, test at different positions
            if (!track.isStream) {
                // Test at 0%, 25%, 50%, 75% positions
                const percentages = [0, 0.25, 0.5, 0.75];
                for (let j = 0; j < percentages.length; j++) {
                    const position = Math.floor(track.length * percentages[j]);
                    
                    // Generate music card with different options
                    const musicCardPath = await createMusicCard(
                        track, 
                        position, 
                        j === 0 ? 50 : (j === 1 ? 75 : (j === 2 ? 100 : 80)), // Different volumes
                        track.uri.includes('youtube') ? 'YouTube' : 
                            (track.uri.includes('spotify') ? 'Spotify' : 
                                (track.uri.includes('twitch') ? 'Twitch' : 'Unknown')),
                        {
                            requester: track.requester,
                            loopMode: j === 0 ? 'none' : (j === 1 ? 'track' : (j === 2 ? 'queue' : 'none')),
                            queueSize: j * 5 // 0, 5, 10, 15 tracks
                        }
                    );
                    
                    // Copy to test output with descriptive name
                    const destPath = path.join(outputDir, 
                        `track${i+1}_${percentages[j]*100}percent_vol${j === 0 ? 50 : (j === 1 ? 75 : (j === 2 ? 100 : 80))}.jpg`);
                    fs.copyFileSync(musicCardPath, destPath);
                    
                    console.log(`Generated ${trackType} card ${i+1}/${mockTracks.length} ` + 
                        `at position ${position}ms (${Math.round(percentages[j]*100)}%)`);
                    console.log(`Saved to: ${destPath}`);
                    
                    // Clean up the original file
                    fs.unlinkSync(musicCardPath);
                }
            } else {
                // For streams, just test once with stream settings
                const musicCardPath = await createMusicCard(
                    track, 
                    0,
                    100, // Full volume for stream
                    'Twitch', // For streams
                    {
                        requester: track.requester,
                        loopMode: 'none',
                        queueSize: 0
                    }
                );
                
                // Copy to test output
                const destPath = path.join(outputDir, `stream_card.jpg`);
                fs.copyFileSync(musicCardPath, destPath);
                
                console.log(`Generated ${trackType} card for live stream`);
                console.log(`Saved to: ${destPath}`);
                
                // Clean up the original file
                fs.unlinkSync(musicCardPath);
            }
        }
        
        console.log('All test cards generated successfully!');
    } catch (error) {
        console.error('Error during test:', error);
    }
}

// Run the test
testImageCard();