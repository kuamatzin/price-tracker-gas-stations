# Deployment Architecture

## Deployment Strategy

**Frontend Deployment:**

- **Platform:** Vercel
- **Build Command:** `cd apps/web && npm run build`
- **Output Directory:** `apps/web/dist`
- **CDN/Edge:** Vercel Edge Network (automatic)

**Backend Deployment:**

- **Platform:** Laravel Forge + Vultr VPS
- **Build Command:** `cd apps/api && composer install --no-dev && php artisan optimize`
- **Deployment Method:** Git push with Forge auto-deploy

## CI/CD Pipeline

```yaml

```
