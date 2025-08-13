# Unified Project Structure

```
fuelintel/
├── .github/                    # CI/CD workflows
│   └── workflows/
│       ├── ci.yaml            # Test runner
│       └── deploy.yaml        # Deployment automation
├── apps/                       # Application packages
│   ├── web/                    # React frontend application
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   │   ├── ui/        # shadcn/ui components
│   │   │   │   ├── common/    # Shared components
│   │   │   │   ├── features/  # Feature-specific
│   │   │   │   └── charts/    # Data visualizations
│   │   │   ├── pages/          # Route components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── services/       # API client services
│   │   │   ├── stores/         # Zustand state management
│   │   │   ├── styles/         # Global styles/themes
│   │   │   ├── utils/          # Frontend utilities
│   │   │   └── main.tsx        # App entry point
│   │   ├── public/             # Static assets
│   │   ├── tests/              # Frontend tests
│   │   ├── .env.example
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── api/                    # Laravel backend application
│   │   ├── app/
│   │   │   ├── Http/
│   │   │   │   ├── Controllers/
│   │   │   │   ├── Middleware/
│   │   │   │   └── Requests/
│   │   │   ├── Models/
│   │   │   ├── Services/       # Business logic
│   │   │   ├── Repositories/   # Data access layer
│   │   │   ├── Jobs/           # Queue jobs
│   │   │   └── Console/        # Artisan commands
│   │   ├── config/             # Laravel config
│   │   ├── database/
│   │   │   ├── migrations/
│   │   │   └── seeders/
│   │   ├── routes/
│   │   │   ├── api.php
│   │   │   └── webhooks.php
│   │   ├── tests/              # Backend tests
│   │   ├── .env.example
│   │   ├── composer.json
│   │   └── artisan
│   └── scraper/                # Node.js scraper service
│       ├── src/
│       │   ├── scrapers/       # Scraping logic
│       │   │   ├── estados.ts
│       │   │   ├── municipios.ts
│       │   │   └── prices.ts
│       │   ├── db/             # Database connections
│       │   ├── utils/          # Helper functions
│       │   ├── config.ts       # Configuration
│       │   └── index.ts        # Entry point
│       ├── tests/              # Scraper tests
│       ├── .env.example
│       ├── tsconfig.json
│       └── package.json
├── packages/                   # Shared packages
│   ├── shared/                 # Shared types/utilities
│   │   ├── src/
│   │   │   ├── types/          # TypeScript interfaces
│   │   │   │   ├── models.ts  # Data models
│   │   │   │   ├── api.ts     # API types
│   │   │   │   └── index.ts
│   │   │   ├── constants/      # Shared constants
│   │   │   │   ├── fuel.ts    # Fuel type mappings
│   │   │   │   └── regions.ts # Mexican states/municipios
│   │   │   └── utils/          # Shared utilities
│   │   │       ├── price.ts   # Price calculations
│   │   │       └── date.ts    # Date helpers
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── config/                 # Shared configuration
│       ├── eslint/
│       │   └── .eslintrc.js
│       ├── typescript/
│       │   └── tsconfig.base.json
│       └── prettier/
│           └── .prettierrc
├── infrastructure/             # Infrastructure as Code
│   ├── forge/                  # Laravel Forge configs
│   │   ├── deploy.sh          # Deployment script
│   │   └── supervisor.conf    # Process management
│   ├── docker/                 # Docker configs
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.scraper
│   │   └── docker-compose.yml
│   └── vercel/                 # Vercel configuration
│       └── vercel.json
├── scripts/                    # Build/deploy scripts
│   ├── setup.sh               # Initial setup
│   ├── seed-db.sh             # Database seeding
│   └── run-scraper.sh         # Manual scraper run
├── docs/                       # Documentation
│   ├── prd.md
│   ├── front-end-spec.md
│   └── architecture.md        # This document
├── .env.example                # Environment template
├── package.json                # Root package.json
├── package-lock.json
└── README.md
```
