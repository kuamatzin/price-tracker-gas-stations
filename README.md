# FuelIntel - Mexican Gas Price Tracking Platform

A comprehensive platform for tracking and predicting gasoline prices across Mexico, providing real-time data, price alerts, and predictive analytics.

## 🚀 Quick Start

### Prerequisites

- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher
- **PHP**: v8.3 or higher
- **Composer**: v2.0 or higher
- **Docker**: v20.10 or higher
- **Docker Compose**: v2.0 or higher
- **PostgreSQL**: v15 or higher (via Docker)
- **Redis**: v7.0 or higher (via Docker)

### Setup Instructions (< 15 minutes)

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/fuelintel.git
   cd fuelintel
   ```

2. **Copy environment files**
   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   cp apps/scraper/.env.example apps/scraper/.env
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start Docker services**
   ```bash
   cd infrastructure/docker
   docker-compose up -d
   ```

5. **Setup Laravel API**
   ```bash
   cd apps/api
   composer install
   php artisan key:generate
   php artisan migrate
   php artisan db:seed
   ```

6. **Start development servers**
   
   In separate terminals:
   
   ```bash
   # Terminal 1 - API
   cd apps/api
   php artisan serve
   ```
   
   ```bash
   # Terminal 2 - Web
   cd apps/web
   npm run dev
   ```
   
   ```bash
   # Terminal 3 - Scraper (optional)
   cd apps/scraper
   npm run dev
   ```

7. **Access the application**
   - Web: http://localhost:5173
   - API: http://localhost:8000
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

## 📁 Project Structure

```
fuelintel/
├── apps/                       # Application packages
│   ├── web/                   # React frontend (Vite + TypeScript)
│   ├── api/                   # Laravel backend API
│   └── scraper/               # Node.js price scraper
├── packages/                   # Shared packages
│   ├── shared/                # TypeScript types & utilities
│   └── config/                # Shared configurations
├── infrastructure/            # Infrastructure configurations
│   └── docker/               # Docker configurations
├── scripts/                   # Build and utility scripts
└── docs/                     # Documentation
```

## 🛠️ Development

### Available Commands

```bash
# Root level commands
npm run dev          # Start all services in development mode
npm run build        # Build all packages
npm run test         # Run tests for all packages
npm run lint         # Lint all packages
npm run format       # Format code with Prettier

# Laravel API commands (in apps/api)
php artisan serve    # Start Laravel development server
php artisan migrate  # Run database migrations
php artisan test     # Run PHPUnit tests

# React Web commands (in apps/web)
npm run dev          # Start Vite development server
npm run build        # Build for production
npm run preview      # Preview production build

# Scraper commands (in apps/scraper)
npm run dev          # Start scraper in watch mode
npm run build        # Build TypeScript files
npm run start        # Run compiled scraper
```

### Git Workflow

This project uses conventional commits with the following types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or changes
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes

Example:
```bash
git commit -m "feat: add price alert notifications"
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm run test

# Frontend tests
cd apps/web && npm run test

# Backend tests
cd apps/api && php artisan test

# Scraper tests
cd apps/scraper && npm run test
```

### Test Coverage

```bash
# Generate coverage reports
npm run test:coverage
```

## 🐳 Docker

### Starting Services

```bash
cd infrastructure/docker
docker-compose up -d
```

### Stopping Services

```bash
docker-compose down
```

### Viewing Logs

```bash
docker-compose logs -f [service-name]
```

### Available Services

- `postgres`: PostgreSQL database
- `redis`: Redis cache/queue
- `api`: Laravel API server
- `scraper`: Node.js scraper service

## 🔧 Troubleshooting

### Common Issues

#### Port Already in Use
If you get a "port already in use" error:
```bash
# Check what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :8000  # Laravel
lsof -i :5173  # Vite

# Kill the process
kill -9 [PID]
```

#### Database Connection Failed
1. Ensure Docker services are running
2. Check database credentials in `.env` files
3. Verify PostgreSQL is accessible:
   ```bash
   docker-compose ps
   ```

#### npm Install Fails
1. Clear npm cache:
   ```bash
   npm cache clean --force
   ```
2. Delete node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

#### Laravel Permissions Issues
```bash
cd apps/api
chmod -R 777 storage bootstrap/cache
```

### Platform-Specific Notes

#### Windows (WSL2)
- Ensure WSL2 is installed and updated
- Use Ubuntu or Debian distro for best compatibility
- Run commands from WSL2 terminal, not PowerShell

#### macOS
- Install Xcode Command Line Tools if needed:
  ```bash
  xcode-select --install
  ```

#### Linux
- Ensure user is in docker group:
  ```bash
  sudo usermod -aG docker $USER
  ```

## 📚 Additional Resources

- [Laravel Documentation](https://laravel.com/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Docker Documentation](https://docs.docker.com)

## 📝 License

This project is proprietary and confidential.

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📧 Support

For support, email support@fuelintel.mx or create an issue in the repository.