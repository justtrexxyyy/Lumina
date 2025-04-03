#!/bin/bash

# This script will replace emoji references in all command files

# Loop through all command files
for file in ./commands/*.js; do
  # Replace emoji references in titles with plain text
  sed -i "s/\${config\.emojis\.[a-zA-Z0-9]*} //g" "$file"
done

echo "Fixed emoji references in command files"