# Coding Standards

## Critical Fullstack Rules

- **Type Sharing:** Always define types in packages/shared and import from there
- **API Calls:** Never make direct HTTP calls - use the service layer
- **Environment Variables:** Access only through config objects, never process.env directly
- **Error Handling:** All API routes must use the standard error handler
- **State Updates:** Never mutate state directly - use proper state management patterns
- **Database Queries:** Use repository pattern, never raw SQL in controllers
- **Price Storage:** Only store price changes, never daily snapshots
- **Fuel Type Mapping:** Always normalize government SubProducto to our 3 types
- **Cache Keys:** Use consistent naming: `{entity}:{id}:{property}`
- **Queue Jobs:** All heavy operations must be queued, never block API responses

## Naming Conventions

| Element         | Frontend             | Backend             | Example                             |
| --------------- | -------------------- | ------------------- | ----------------------------------- |
| Components      | PascalCase           | -                   | `PriceCard.tsx`                     |
| Hooks           | camelCase with 'use' | -                   | `useAuth.ts`                        |
| API Routes      | -                    | kebab-case          | `/api/prices-nearby`                |
| Database Tables | -                    | snake_case plural   | `price_changes`                     |
| Models          | -                    | PascalCase singular | `PriceChange.php`                   |
| Services        | camelCase            | PascalCase          | `pricingService` / `PricingService` |
