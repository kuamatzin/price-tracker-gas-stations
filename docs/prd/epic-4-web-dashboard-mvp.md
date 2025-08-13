# Epic 4: Web Dashboard MVP

**Goal:** Create a visually intuitive web dashboard that complements the Telegram bot with rich data visualizations and configuration capabilities. The mobile-first React application provides deeper analytics, visual trend analysis, and administrative functions that benefit from a larger screen format. This epic delivers the visual intelligence layer that transforms data into insights through charts, maps, and comparative visualizations.

## Story 4.1: React Application Setup

As a frontend developer,
I want to establish the React application structure with routing and state management,
so that we can build a scalable dashboard application.

### Acceptance Criteria

1: React app with TypeScript configured using Vite for fast development builds
2: React Router implements routes for /login, /dashboard, /prices, /analytics, /settings
3: Zustand or Redux Toolkit configured for global state management
4: Shadcn/ui components library integrated with Tailwind CSS configuration
5: Axios configured with interceptors for API authentication and error handling
6: Responsive layout shell with mobile-first breakpoints (320px, 768px, 1024px)

## Story 4.2: Authentication & Dashboard Layout

As a dashboard user,
I want to securely log in and navigate the dashboard,
so that I can access my personalized pricing data.

### Acceptance Criteria

1: Login page with email/password form and "Remember Me" functionality
2: JWT token storage in localStorage with auto-refresh before expiration
3: Dashboard layout with responsive navigation (hamburger menu on mobile)
4: User profile dropdown with station name, logout option, and settings link
5: Persistent sidebar on desktop, bottom navigation on mobile
6: Loading states and error boundaries for graceful error handling

## Story 4.3: Current Prices & Competitor View

As a visual learner,
I want to see current prices and competitor comparisons visually,
so that I can quickly understand market positioning.

### Acceptance Criteria

1: Price cards display current prices for all fuel types with trend arrows
2: Competitor table sortable by distance, price, and brand
3: Map view shows competitor locations with price labels (using Leaflet or Mapbox)
4: Color coding indicates price competitiveness (green=cheap, red=expensive)
5: Quick filters for fuel type, distance radius, and brand
6: Export functionality for competitor data in CSV format

## Story 4.4: Historical Trends Visualization

As a data analyst,
I want to see price trends in interactive charts,
so that I can identify patterns and opportunities.

### Acceptance Criteria

1: Line chart displays price history with selectable date ranges (7, 15, 30 days)
2: Multi-series chart compares user's prices against market average
3: Chart.js or Recharts implementation with zoom and pan capabilities
4: Toggle between fuel types with animated transitions
5: Tooltip shows exact values and percentage changes on hover
6: Trend summary statistics (avg, min, max, volatility) displayed below chart

## Story 4.5: Analytics Dashboard

As a strategic planner,
I want comprehensive analytics in a single view,
so that I can make informed business decisions.

### Acceptance Criteria

1: Dashboard grid layout with customizable widget arrangement
2: KPI cards show ranking position, price spread, and market position
3: Mini charts display 7-day trends for each fuel type
4: Alert feed shows recent price changes and recommendations
5: Market heat map visualizes regional price variations
6: Performance optimized to load all widgets in under 3 seconds

## Story 4.6: Mobile Optimization & PWA

As a mobile user,
I want a native app-like experience on my phone,
so that I can access the dashboard conveniently.

### Acceptance Criteria

1: Progressive Web App configuration with service worker for offline capability
2: Add to Home Screen prompt with custom icon and splash screen
3: Touch-optimized interactions with swipe gestures for navigation
4: Responsive charts that remain readable on 320px screens
5: Lighthouse score of 90+ for Performance, Accessibility, and Best Practices
6: Offline mode shows cached data with clear "last updated" timestamps
