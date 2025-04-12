#!/bin/bash
# Audic Discord Music Bot VPS Setup Script

echo "===== Audic Discord Music Bot - VPS Setup Script ====="
echo "This script will help you set up your environment properly."
echo

# Check if running as root
if [ "$(id -u)" -eq 0 ]; then
  echo "This script should not be run as root. Please run as a regular user."
  exit 1
fi

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check Node.js installation
echo "Checking Node.js installation..."
if command_exists node; then
  NODE_VERSION=$(node -v)
  echo "Node.js $NODE_VERSION is installed."
  
  # Check if Node.js version is 16.9.0 or higher
  NODE_VERSION_NUM=$(echo $NODE_VERSION | cut -d 'v' -f 2)
  NODE_MAJOR=$(echo $NODE_VERSION_NUM | cut -d '.' -f 1)
  
  if [ $NODE_MAJOR -lt 16 ]; then
    echo "WARNING: Your Node.js version is less than 16.9.0, which is required for Discord.js v14."
    echo "Consider upgrading your Node.js version."
  else
    echo "Node.js version is compatible."
  fi
else
  echo "ERROR: Node.js is not installed."
  echo "Please install Node.js v16.9.0 or higher."
  echo "You can run: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi

# Check npm installation
echo
echo "Checking npm installation..."
if command_exists npm; then
  NPM_VERSION=$(npm -v)
  echo "npm $NPM_VERSION is installed."
else
  echo "ERROR: npm is not installed."
  echo "Please install npm (it should come with Node.js)."
  exit 1
fi

# Check for Canvas dependencies
echo
echo "Checking Canvas dependencies..."
MISSING_DEPS=0

check_package() {
  if ! dpkg -l | grep -q "$1"; then
    echo "- Missing: $1"
    MISSING_DEPS=1
  fi
}

check_package "libcairo2-dev"
check_package "libpango1.0-dev"
check_package "libjpeg-dev"
check_package "libgif-dev"
check_package "librsvg2-dev"
check_package "build-essential"

if [ $MISSING_DEPS -eq 1 ]; then
  echo "Some dependencies for Canvas are missing."
  echo "Run this command to install them:"
  echo "sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev"
else
  echo "All Canvas dependencies are installed."
fi

# Check if the project files exist
echo
echo "Checking for required bot files..."
if [ ! -f "index.js" ]; then
  echo "ERROR: index.js not found in the current directory."
  echo "Make sure you run this script from the bot's root directory."
  exit 1
fi

if [ ! -f "package.json" ]; then
  echo "ERROR: package.json not found in the current directory."
  echo "Make sure you run this script from the bot's root directory."
  exit 1
fi

# Check if .env file exists
echo
echo "Checking for .env file..."
if [ ! -f ".env" ]; then
  echo "WARNING: .env file not found."
  echo "Creating a template .env file..."
  cat > .env << EOF
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
LAVALINK_HOST=lavalink.jirayu.net
LAVALINK_PORT=13592
LOG_WEBHOOK_URL=your_discord_webhook_url
EOF
  echo "Please edit the .env file and add your actual values."
else
  echo ".env file exists."
  
  # Check if required environment variables are defined
  if ! grep -q "DISCORD_TOKEN" .env; then
    echo "WARNING: DISCORD_TOKEN is not defined in .env file."
  fi
  
  if ! grep -q "CLIENT_ID" .env; then
    echo "WARNING: CLIENT_ID is not defined in .env file."
  fi
  
  if ! grep -q "LAVALINK_HOST" .env; then
    echo "WARNING: LAVALINK_HOST is not defined in .env file."
  fi
  
  if ! grep -q "LAVALINK_PORT" .env; then
    echo "WARNING: LAVALINK_PORT is not defined in .env file."
  fi
fi

# Check for node_modules
echo
echo "Checking for installed dependencies..."
if [ ! -d "node_modules" ]; then
  echo "node_modules directory not found."
  echo "Installing dependencies with npm..."
  npm install
  
  if [ $? -ne 0 ]; then
    echo "ERROR: npm install failed."
    echo "Trying to fix by cleaning npm cache..."
    npm cache clean --force
    echo "Removing node_modules (if it exists)..."
    rm -rf node_modules
    echo "Retrying npm install..."
    npm install
    
    if [ $? -ne 0 ]; then
      echo "ERROR: npm install failed again. Please try installing dependencies manually."
      exit 1
    fi
  fi
  
  echo "Dependencies installed successfully."
else
  echo "node_modules directory exists."
  echo "Ensuring all dependencies are up to date..."
  npm install
fi

# Check for PM2
echo
echo "Checking for PM2 (process manager)..."
if ! command_exists pm2; then
  echo "PM2 is not installed."
  echo "PM2 is recommended for keeping your bot running."
  echo "Would you like to install PM2? (y/n)"
  read -r INSTALL_PM2
  
  if [ "$INSTALL_PM2" = "y" ] || [ "$INSTALL_PM2" = "Y" ]; then
    echo "Installing PM2..."
    npm install -g pm2
    
    if [ $? -ne 0 ]; then
      echo "ERROR: Failed to install PM2."
      echo "Try installing manually with: sudo npm install -g pm2"
    else
      echo "PM2 installed successfully."
    fi
  else
    echo "Skipping PM2 installation."
  fi
else
  echo "PM2 is already installed."
fi

echo
echo "===== Setup Complete ====="
echo
echo "To start your bot with Node.js:"
echo "  node index.js"
echo
echo "To start your bot with PM2 (if installed):"
echo "  pm2 start index.js --name \"audic-bot\""
echo "  pm2 startup"
echo "  pm2 save"
echo
echo "If you encounter any issues, refer to the DEPLOYMENT_GUIDE.md file."
echo