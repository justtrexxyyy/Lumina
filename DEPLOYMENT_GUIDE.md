# Audic Discord Music Bot - VPS Deployment Guide

This guide will help you deploy your Audic Discord Music Bot on a VPS (Virtual Private Server) without encountering errors.

## Common Errors

1. **"Could not find module dotenv"** - This happens when the dotenv package isn't properly installed.
2. **"Could not find module index.js"** - This happens when the Node.js environment isn't set up correctly.

## Deployment Steps

### 1. Prepare Your VPS

Make sure you have Node.js v16.9.0 or higher installed on your VPS:

```bash
# Update your package lists
sudo apt update

# Install Node.js and npm (if using Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Check Node.js version
node -v
# Should show v18.x.x
```

### 2. Install Required System Dependencies

For the Canvas library to work properly, install these dependencies:

```bash
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

### 3. Transfer Your Bot Files

Upload all your bot files to your VPS. Make sure to include:
- All files and folders (commands, events, utils)
- package.json
- index.js
- config.js

### 4. Create .env File

Create a `.env` file in your bot's root directory with these variables:

```
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
LAVALINK_HOST=lavalink.jirayu.net
LAVALINK_PORT=13592
LOG_WEBHOOK_URL=your_discord_webhook_url
```

Replace `your_discord_bot_token`, `your_discord_client_id`, and `your_discord_webhook_url` with your actual values.

### 5. Install Dependencies

Navigate to your bot's directory and install dependencies:

```bash
cd /path/to/your/bot
npm install
```

If npm gives errors, try cleaning the cache:

```bash
npm cache clean --force
rm -rf node_modules
npm install
```

### 6. Start Your Bot

Start your bot using Node.js:

```bash
node index.js
```

For keeping the bot running even after closing your SSH session, use a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Start your bot with PM2
pm2 start index.js --name "audic-bot"

# Set PM2 to start on system boot
pm2 startup
pm2 save
```

## Troubleshooting

### Error: "Cannot find module 'dotenv'"

If you see this error, run:

```bash
npm install dotenv
```

### Error: "Could not find module 'index.js'"

Make sure you're running the command from the correct directory:

```bash
# Check current directory contents
ls -la

# Make sure index.js exists in current directory
# If not, navigate to the correct directory
cd /correct/path

# Then try running the bot again
node index.js
```

### Error: Canvas-related issues

If you encounter Canvas errors, reinstall it with:

```bash
npm uninstall canvas
npm install canvas
```

### Other Dependency Errors

Try running a fresh installation:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Additional Tips

1. Always check that your .env file is properly formatted (no spaces around the = sign)
2. Make sure all file paths in your code use Unix-style paths with forward slashes (/)
3. Check server logs if the bot crashes: `pm2 logs audic-bot`
4. Set up proper error handling to troubleshoot issues when deployed

Good luck with your Audic Discord Music Bot deployment!