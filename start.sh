#!/bin/bash

# File Organizer - Start Script
# Starts the Electron development server

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Navigate to project root
cd "$SCRIPT_DIR"

echo "🚀 Starting File Organizer (Nexus)..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "�Package Installing dependencies..."
  npm install
  echo ""
fi

# Start the development server
echo "⚡ Launching development environment..."
npm run electron:dev