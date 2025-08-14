# Secrets Management Documentation

## Overview

This document outlines the strategy for managing sensitive information (API keys, passwords, tokens) across different environments.

## Security Principles

1. **Never commit secrets to version control**
2. **Use different secrets for each environment**
3. **Rotate secrets regularly**
4. **Principle of least privilege**
5. **Audit secret access**

## Secret Storage by Environment

### Local Development

**Storage Method:** `.env` files

**Location:**

- `/apps/api/.env`
- `/apps/web/.env`
- `/apps/scraper/.env`

**Setup:**

```bash
# Copy example files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/scraper/.env.example apps/scraper/.env

# Edit with your values
nano apps/api/.env
```

**Git Configuration:**

```gitignore
# Already in .gitignore
*.env
.env.*
!.env.example
```

### CI/CD (GitHub Actions)

**Storage Method:** GitHub Secrets

**Configuration:**

1. Go to repository Settings → Secrets → Actions
2. Click "New repository secret"
3. Add each secret

**Required Secrets:**

| Secret Name         | Description                  | Example Value                   |
| ------------------- | ---------------------------- | ------------------------------- |
| `VERCEL_TOKEN`      | Vercel deployment token      | `abc123...`                     |
| `VERCEL_PROJECT_ID` | Vercel project ID            | `prj_123...`                    |
| `VERCEL_ORG_ID`     | Vercel organization ID       | `team_123...`                   |
| `FORGE_WEBHOOK_URL` | Laravel Forge deploy webhook | `https://forge.laravel.com/...` |
| `SENTRY_AUTH_TOKEN` | Sentry authentication token  | `sntr_123...`                   |
| `SENTRY_ORG`        | Sentry organization slug     | `fuelintel`                     |

**Usage in Workflows:**

```yaml
env:
  VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

### Production (Laravel Forge)

**Storage Method:** Environment Variables in Forge Dashboard

**Configuration:**

1. Log into Laravel Forge
2. Select your server
3. Select your site
4. Click "Environment" tab
5. Edit environment file
6. Click "Save"

**Auto-reload:**

```bash
# Add to deploy script
php artisan config:cache
```

### Staging (Optional)

**Storage Method:** Separate `.env.staging` or Forge staging site

**Best Practice:** Use completely different secrets from production

## Secret Types and Management

### API Keys

**Telegram Bot Token**

- Format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
- Obtain from: @BotFather on Telegram
- Rotation: Every 6 months or if compromised

**DeepSeek API Key**

- Format: `dsk_xxxxxxxxxxxxxxxxxxxx`
- Obtain from: platform.deepseek.com
- Rotation: Every 3 months
- Monitor: Usage and billing

**Sentry DSN**

- Format: `https://xxx@xxx.ingest.sentry.io/xxx`
- Obtain from: Sentry project settings
- Rotation: Only if compromised

### Database Credentials

**PostgreSQL Password**

- Generate: Use strong password generator
- Length: Minimum 32 characters
- Characters: Alphanumeric + special
- Example generator:

```bash
openssl rand -base64 32
```

**Connection String Format:**

```
postgresql://username:password@host:port/database
```

### Authentication Secrets

**Laravel APP_KEY**

- Generate:

```bash
php artisan key:generate --show
```

- Format: `base64:xxxxxxxxxxxxxxxxxxxx`
- Never change in production (breaks encrypted data)

**JWT/Sanctum Secrets**

- Length: 64 characters minimum
- Generate:

```bash
openssl rand -hex 32
```

### Webhook Secrets

**Format:** Random string, minimum 32 characters

**Generate:**

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using PHP
php -r "echo bin2hex(random_bytes(32));"
```

**Verification Example:**

```php
// Laravel webhook verification
$signature = hash_hmac('sha256', $request->getContent(), config('services.webhook.secret'));
if (!hash_equals($signature, $request->header('X-Webhook-Signature'))) {
    abort(401, 'Invalid signature');
}
```

## Environment Variable Templates

### Complete Laravel .env Template

```env
# Application
APP_NAME=FuelIntel
APP_ENV=production
APP_KEY=base64:GENERATE_NEW_KEY_HERE
APP_DEBUG=false
APP_URL=https://api.fuelintel.mx

# Database
DB_CONNECTION=pgsql
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=fuelintel
DB_USERNAME=fuelintel_user
DB_PASSWORD=STRONG_PASSWORD_HERE

# Redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=REDIS_PASSWORD_HERE
REDIS_PORT=6379

# External Services
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET=GENERATE_RANDOM_SECRET
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_KEY
SENTRY_LARAVEL_DSN=YOUR_SENTRY_DSN

# S3/Vultr Object Storage
AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
AWS_BUCKET=fuelintel-reports
AWS_ENDPOINT=https://ewr1.vultrobjects.com
```

### Complete React .env Template

```env
VITE_API_URL=https://api.fuelintel.mx/api
VITE_SENTRY_DSN=YOUR_SENTRY_DSN
VITE_SENTRY_ENVIRONMENT=production
```

### Complete Scraper .env Template

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@localhost:5432/fuelintel
WEBHOOK_URL=https://api.fuelintel.mx/api/webhook/scraper
WEBHOOK_SECRET=SAME_AS_LARAVEL_WEBHOOK_SECRET
SENTRY_DSN=YOUR_SENTRY_DSN
```

## Secret Rotation Schedule

| Secret Type           | Rotation Period | Priority |
| --------------------- | --------------- | -------- |
| Database passwords    | 6 months        | High     |
| API tokens (external) | 3 months        | Medium   |
| Webhook secrets       | 6 months        | Low      |
| Laravel APP_KEY       | Never\*         | Critical |
| SSL certificates      | Before expiry   | Critical |

\*Never rotate Laravel APP_KEY in production unless compromised

## Team Secret Sharing

### Option 1: Encrypted File (Simple)

```bash
# Encrypt
gpg --symmetric --cipher-algo AES256 .env
# Creates .env.gpg

# Decrypt
gpg --decrypt .env.gpg > .env
```

### Option 2: Password Manager

- Use team password manager (1Password, Bitwarden)
- Create shared vault for project
- Store each secret with clear labels

### Option 3: Secret Management Service

- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault

### Option 4: dotenv-vault (Recommended for Teams)

```bash
# Install
npm install -g dotenv-vault

# Login
npx dotenv-vault login

# Push secrets
npx dotenv-vault push

# Pull secrets (team member)
npx dotenv-vault pull
```

## Security Audit Checklist

### Daily

- [ ] Check Sentry for security-related errors
- [ ] Monitor API rate limits

### Weekly

- [ ] Review access logs
- [ ] Check for unusual API usage patterns

### Monthly

- [ ] Audit GitHub repository access
- [ ] Review Forge server access logs
- [ ] Check for exposed secrets in code

### Quarterly

- [ ] Rotate API keys
- [ ] Update webhook secrets
- [ ] Review and update access permissions

## Incident Response

### If a Secret is Exposed

1. **Immediate Actions**
   - Rotate the compromised secret immediately
   - Update all services using the secret
   - Check logs for unauthorized access

2. **Investigation**
   - Determine how the secret was exposed
   - Check git history for accidental commits
   - Review access logs during exposure window

3. **Remediation**
   - Update the secret in all environments
   - Deploy updated configuration
   - Monitor for suspicious activity

4. **Prevention**
   - Add additional git pre-commit hooks
   - Enhance secret scanning in CI/CD
   - Team training on secret management

## Git Hooks for Secret Protection

### Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Patterns to search for
PATTERNS=(
    "API[_-]?KEY"
    "SECRET"
    "PASSWORD"
    "TOKEN"
    "PRIVATE[_-]?KEY"
    "DB[_-]?PASS"
)

# Check staged files
for pattern in "${PATTERNS[@]}"; do
    git diff --staged --name-only | xargs -I {} git diff --staged {} | grep -E "$pattern.*=.*['\"]?[A-Za-z0-9+/]{20,}" && {
        echo "❌ Potential secret detected! Please review your changes."
        exit 1
    }
done

echo "✅ No secrets detected"
exit 0
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

## Common Commands

### Generate Secure Passwords

```bash
# 32 character password
openssl rand -base64 32

# 64 character hex string
openssl rand -hex 32

# UUID v4
uuidgen

# Laravel key
php artisan key:generate --show
```

### Verify Environment

```bash
# Check Laravel config
php artisan config:show

# Check Node env
node -e "console.log(process.env)"

# Check specific var
echo $VARIABLE_NAME
```

### Encrypt/Decrypt Files

```bash
# Encrypt with password
openssl enc -aes-256-cbc -salt -in .env -out .env.enc

# Decrypt
openssl enc -aes-256-cbc -d -in .env.enc -out .env
```

## Best Practices Summary

1. ✅ Use `.env.example` files with dummy values
2. ✅ Never log sensitive information
3. ✅ Use HTTPS for all API calls
4. ✅ Implement webhook signature verification
5. ✅ Use strong, unique passwords
6. ✅ Enable 2FA on all service accounts
7. ✅ Regularly audit and rotate secrets
8. ✅ Use different secrets per environment
9. ✅ Implement proper error handling (don't expose secrets in errors)
10. ✅ Document but don't share actual secret values

## Emergency Contacts

- **Security Lead:** [Your Name]
- **DevOps Lead:** [Name]
- **On-call rotation:** [Schedule]

## References

- [OWASP Secret Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [12 Factor App - Config](https://12factor.net/config)
- [Laravel Environment Configuration](https://laravel.com/docs/configuration)
- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
