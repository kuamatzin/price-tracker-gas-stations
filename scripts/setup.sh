#!/bin/bash

# FuelIntel Setup Script
# Works on macOS, Linux, and Windows (WSL2)

set -e

echo "🚀 FuelIntel Setup Script"
echo "========================="
echo ""

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
else
    OS="unknown"
fi

echo "Detected OS: $OS"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v20 or higher."
    exit 1
else
    NODE_VERSION=$(node -v)
    echo "✅ Node.js $NODE_VERSION"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
else
    NPM_VERSION=$(npm -v)
    echo "✅ npm $NPM_VERSION"
fi

# Check PHP
if ! command -v php &> /dev/null; then
    echo "❌ PHP is not installed. Please install PHP 8.3 or higher."
    exit 1
else
    PHP_VERSION=$(php -v | head -n 1)
    echo "✅ PHP: $PHP_VERSION"
fi

# Check Composer
if ! command -v composer &> /dev/null; then
    echo "❌ Composer is not installed."
    exit 1
else
    COMPOSER_VERSION=$(composer --version | head -n 1)
    echo "✅ $COMPOSER_VERSION"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed."
    exit 1
else
    DOCKER_VERSION=$(docker --version)
    echo "✅ $DOCKER_VERSION"
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    if ! docker compose version &> /dev/null; then
        echo "❌ Docker Compose is not installed."
        exit 1
    else
        COMPOSE_VERSION=$(docker compose version)
        echo "✅ Docker Compose: $COMPOSE_VERSION"
    fi
else
    COMPOSE_VERSION=$(docker-compose --version)
    echo "✅ $COMPOSE_VERSION"
fi

echo ""
echo "All prerequisites met! ✅"
echo ""

# Copy environment files
echo "Setting up environment files..."

if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created root .env"
else
    echo "⚠️  Root .env already exists, skipping..."
fi

if [ ! -f apps/api/.env ]; then
    cp apps/api/.env.example apps/api/.env
    echo "✅ Created apps/api/.env"
else
    echo "⚠️  apps/api/.env already exists, skipping..."
fi

if [ ! -f apps/web/.env ]; then
    cp apps/web/.env.example apps/web/.env
    echo "✅ Created apps/web/.env"
else
    echo "⚠️  apps/web/.env already exists, skipping..."
fi

if [ ! -f apps/scraper/.env ]; then
    cp apps/scraper/.env.example apps/scraper/.env
    echo "✅ Created apps/scraper/.env"
else
    echo "⚠️  apps/scraper/.env already exists, skipping..."
fi

echo ""

# Install dependencies
echo "Installing npm dependencies..."
npm install
echo "✅ npm dependencies installed"
echo ""

# Install Laravel dependencies
echo "Installing Laravel dependencies..."
cd apps/api
composer install
cd ../..
echo "✅ Laravel dependencies installed"
echo ""

# Generate Laravel key
echo "Generating Laravel application key..."
cd apps/api
php artisan key:generate
cd ../..
echo "✅ Laravel key generated"
echo ""

# Start Docker services
echo "Starting Docker services..."
cd infrastructure/docker
docker-compose up -d
cd ../..
echo "✅ Docker services started"
echo ""

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Run migrations
echo "Running database migrations..."
cd apps/api
php artisan migrate --force
cd ../..
echo "✅ Database migrations completed"
echo ""

echo "🎉 Setup complete!"
echo ""
echo "You can now start the development servers:"
echo ""
echo "  API Server:"
echo "    cd apps/api && php artisan serve"
echo ""
echo "  Web Server:"
echo "    cd apps/web && npm run dev"
echo ""
echo "  Scraper (optional):"
echo "    cd apps/scraper && npm run dev"
echo ""
echo "Access the application at:"
echo "  Web: http://localhost:5173"
echo "  API: http://localhost:8000"
echo ""