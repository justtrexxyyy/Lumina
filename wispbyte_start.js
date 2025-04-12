// Wispbyte-specific fix for Audic Discord Bot
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directory where the bot is located
const BOT_DIR = '/home/container';

// Ensure we're in the right directory
try {
  process.chdir(BOT_DIR);
} catch (e) {
  console.log(`Failed to change to ${BOT_DIR}, using current directory instead.`);
}

// Log startup information
console.log('Starting Audic Discord Bot in Wispbyte environment...');
console.log(`Current directory: ${process.cwd()}`);
console.log(`Node.js version: ${process.version}`);
console.log(`Files in current directory: ${fs.readdirSync('.').join(', ')}`);

// Check if .env exists, create if not
if (!fs.existsSync(path.join(process.cwd(), '.env'))) {
  console.log('Creating .env file...');
  const envContent = `DISCORD_TOKEN=your_token_here
CLIENT_ID=your_client_id_here
LAVALINK_HOST=lavalink.jirayu.net
LAVALINK_PORT=13592
LOG_WEBHOOK_URL=your_webhook_url_here`;
  
  fs.writeFileSync(path.join(process.cwd(), '.env'), envContent);
  console.log('Created .env file - please update with your actual values!');
}

// Try to install dotenv if it's missing
try {
  require('dotenv');
  console.log('dotenv module found.');
} catch (e) {
  console.log('dotenv module missing, attempting to install...');
  try {
    // Create node_modules directory if it doesn't exist
    if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
      try {
        fs.mkdirSync(path.join(process.cwd(), 'node_modules'), { recursive: true });
        console.log('Created node_modules directory');
      } catch (err) {
        console.error('Failed to create node_modules directory:', err.message);
      }
    }
    
    // Try installing dotenv
    execSync('npm install --no-package-lock dotenv', { stdio: 'inherit' });
    console.log('dotenv installed successfully.');
  } catch (err) {
    console.error('Failed to install dotenv:', err.message);
    console.log('Attempting manual module creation...');
    
    // Create a minimal dotenv implementation if installation fails
    try {
      const dotenvDir = path.join(process.cwd(), 'node_modules', 'dotenv', 'lib');
      fs.mkdirSync(dotenvDir, { recursive: true });
      
      // Create a simple dotenv implementation
      const dotenvContent = `
// Minimal dotenv implementation
exports.config = function() {
  try {
    const fs = require('fs');
    const envPath = '${path.join(process.cwd(), '.env').replace(/\\/g, '\\\\')}';
    const content = fs.readFileSync(envPath, 'utf8');
    
    content.split('\\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        process.env[key] = value;
      }
    });
    
    return { parsed: process.env };
  } catch (e) {
    console.error('Error loading .env file:', e.message);
    return { error: e };
  }
};
`;
      
      fs.writeFileSync(path.join(dotenvDir, 'main.js'), dotenvContent);
      console.log('Created minimal dotenv implementation');
    } catch (e) {
      console.error('Failed to create dotenv replacement:', e.message);
    }
  }
}

// Manually load .env file if needed
try {
  require('dotenv').config();
  console.log('Loaded environment variables with dotenv');
} catch (e) {
  console.error('Failed to load with dotenv, trying manual load:', e.message);
  
  // Manual environment variable loading
  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        process.env[key] = value;
        console.log(`Set environment variable: ${key}`);
      }
    });
  } catch (err) {
    console.error('Failed to manually load .env file:', err.message);
  }
}

// Check for essential environment variables
console.log('Checking for essential environment variables:');
console.log(`- DISCORD_TOKEN: ${process.env.DISCORD_TOKEN ? 'Present' : 'Missing!'}`);
console.log(`- CLIENT_ID: ${process.env.CLIENT_ID ? 'Present' : 'Missing!'}`);
console.log(`- LAVALINK_HOST: ${process.env.LAVALINK_HOST || 'Missing, using default lavalink.jirayu.net'}`);
console.log(`- LAVALINK_PORT: ${process.env.LAVALINK_PORT || 'Missing, using default 13592'}`);

// Set defaults for missing environment variables
if (!process.env.LAVALINK_HOST) process.env.LAVALINK_HOST = 'lavalink.jirayu.net';
if (!process.env.LAVALINK_PORT) process.env.LAVALINK_PORT = '13592';

// Verify token exists
if (!process.env.DISCORD_TOKEN) {
  console.error('ERROR: DISCORD_TOKEN not found in .env file');
  console.error('Please edit the .env file and add your bot token');
  process.exit(1);
}

// Install essential dependencies if needed
const essentialDeps = ['discord.js', 'node-fetch', 'shoukaku', 'kazagumo'];
let missingDeps = [];

essentialDeps.forEach(dep => {
  try {
    require(dep);
  } catch (e) {
    missingDeps.push(dep);
  }
});

if (missingDeps.length > 0) {
  console.log(`Missing essential dependencies: ${missingDeps.join(', ')}`);
  console.log('Attempting to install missing dependencies...');
  
  try {
    execSync(`npm install --no-package-lock ${missingDeps.join(' ')}`, { stdio: 'inherit' });
    console.log('Dependencies installed successfully');
  } catch (err) {
    console.error('Failed to install dependencies:', err.message);
    console.error('Your bot may not function correctly without these dependencies.');
  }
}

// Start the bot
try {
  console.log('Starting bot...');
  console.log('Loading index.js from: ' + path.join(process.cwd(), 'index.js'));
  
  if (fs.existsSync(path.join(process.cwd(), 'index.js'))) {
    require('./index.js');
    console.log('Bot started successfully!');
  } else {
    console.error('ERROR: index.js not found in the current directory');
    console.log('Files in current directory:', fs.readdirSync('.').join(', '));
    process.exit(1);
  }
} catch (error) {
  console.error('ERROR starting bot:', error.message);
  console.error(error.stack);
}