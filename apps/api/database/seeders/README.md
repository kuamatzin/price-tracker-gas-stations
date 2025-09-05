# Test Users Documentation

## Multi-Station Test Users

The following test users are created by the `MultiStationSeeder` and have different roles across multiple stations:

### 1. Station Owner
- **Email**: owner@fuelintel.mx
- **Password**: Password123!
- **Subscription**: Premium
- **Role**: Owner of 3 stations
- **Permissions**: Full access - manage prices, view all analytics, manage alerts

### 2. Station Manager  
- **Email**: manager@fuelintel.mx
- **Password**: Password123!
- **Subscription**: Professional
- **Roles**: Manager of 2 stations, Viewer of 1 station
- **Permissions**: View prices, view analytics, view alerts (no management)

### 3. Station Viewer
- **Email**: viewer@fuelintel.mx
- **Password**: Password123!
- **Subscription**: Free
- **Role**: Viewer of 2 stations
- **Permissions**: View prices and basic analytics only

### 4. Multi-Role User
- **Email**: multirole@fuelintel.mx
- **Password**: Password123!
- **Subscription**: Professional
- **Roles**: Mixed - Owner of 1 station, Manager of 1 station, Viewer of 1 station
- **Permissions**: Varies by station

### 5. Admin User
- **Email**: admin@fuelintel.mx
- **Password**: Admin123!
- **Subscription**: Enterprise
- **Role**: Owner of all seeded stations
- **Permissions**: Full access to all stations

## Running Seeders

```bash
# Run all seeders
php artisan db:seed

# Run specific seeder
php artisan db:seed --class=MultiStationSeeder

# Fresh migration with seeders
php artisan migrate:fresh --seed
```

## Station Assignment

Station assignments are dynamic based on available stations in the database. The seeder will:
1. Use the first 10 active stations found in the database
2. Distribute them among test users with different roles
3. Display a summary table after seeding

## Notes

- All test users have strong passwords that meet security requirements
- Users have different API rate limits based on subscription tier
- Notification preferences are pre-configured for testing
- The seeder is idempotent - can be run multiple times safely