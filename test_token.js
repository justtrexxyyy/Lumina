// This is a simple test file to check if the Discord token can be accessed correctly
require('dotenv').config();

console.log('Token Test Script');
console.log('=================');
console.log('DISCORD_TOKEN exists:', !!process.env.DISCORD_TOKEN);

// Only show first and last 4 characters for security
if (process.env.DISCORD_TOKEN) {
    const token = process.env.DISCORD_TOKEN;
    const maskedToken = token.substring(0, 4) + '...' + token.substring(token.length - 4);
    console.log('DISCORD_TOKEN first/last 4 chars:', maskedToken);
    console.log('DISCORD_TOKEN length:', token.length);
}

console.log('CLIENT_ID exists:', !!process.env.CLIENT_ID);
if (process.env.CLIENT_ID) {
    console.log('CLIENT_ID length:', process.env.CLIENT_ID.length);
}

console.log('=================');
console.log('Test completed');