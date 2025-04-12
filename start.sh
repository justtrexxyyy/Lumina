#!/bin/bash
# Audic Discord Music Bot - Start Script

echo "Starting Audic Discord Music Bot..."

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo "ERROR: .env file is missing!"
  echo "Please create a .env file with your configuration."
  exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "WARNING: node_modules directory not found."
  echo "Installing dependencies..."
  npm install
  
  if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies."
    exit 1
  fi
fi

# Check for required modules
if [ ! -d "node_modules/dotenv" ]; then
  echo "WARNING: dotenv module not found. Installing..."
  npm install dotenv
fi

if [ ! -d "node_modules/discord.js" ]; then
  echo "WARNING: discord.js module not found. Installing..."
  npm install discord.js
fi

# Start the bot
echo "Launching bot..."
node index.js