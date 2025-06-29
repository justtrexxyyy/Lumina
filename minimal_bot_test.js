// A minimal Discord bot to test if we can connect to Discord API
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

console.log('Minimal Discord Bot Test');
console.log('=======================');
console.log('DISCORD_TOKEN exists:', !!process.env.DISCORD_TOKEN);

// Create a minimal client with only necessary intents
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Add event handlers
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log('Connection successful!');
    console.log('Bot is in', client.guilds.cache.size, 'servers');
    
    // Exit after successful login
    setTimeout(() => {
        console.log('Test completed successfully. Exiting...');
        process.exit(0);
    }, 2000);
});

// Add error handlers
client.on('error', error => {
    console.error('Client error:', error.message);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error.message);
});

// Set a timeout to exit if login takes too long
const loginTimeout = setTimeout(() => {
    console.error('Login timed out after 30 seconds');
    process.exit(1);
}, 30000);

// Log in to Discord
console.log('Attempting to log in...');
client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        clearTimeout(loginTimeout);
        console.log('Login process initiated successfully');
    })
    .catch(error => {
        clearTimeout(loginTimeout);
        console.error('Login failed:', error.message);
        process.exit(1);
    });