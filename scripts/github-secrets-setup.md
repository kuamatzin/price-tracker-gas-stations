# GitHub Secrets Setup Guide

## Required Secrets for CI/CD

This guide helps you configure GitHub Secrets for automated deployments and CI/CD.

## How to Add Secrets

1. Go to your GitHub repository
2. Click **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Enter the name and value
6. Click **Add secret**

## Required Secrets

### 1. Vercel Deployment

#### VERCEL_TOKEN

- **Where to get it:**
  1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
  2. Click "Create Token"
  3. Name: "GitHub Actions"
  4. Scope: Full Account
  5. Copy the token

#### VERCEL_PROJECT_ID

- **Where to get it:**
  1. Go to your Vercel project dashboard
  2. Click "Settings"
  3. Copy "Project ID"

#### VERCEL_ORG_ID

- **Where to get it:**
  1. Go to Vercel dashboard
  2. Click your avatar → Settings
  3. Copy "Team ID" (or your personal ID)

### 2. Laravel Forge Deployment

#### FORGE_WEBHOOK_URL

- **Where to get it:**
  1. Log into Laravel Forge
  2. Select your server
  3. Select your site
  4. Click "Deployments" tab
  5. Scroll to "Deployment Webhook URL"
  6. Copy the entire URL

Example:

```
https://forge.laravel.com/servers/123456/sites/789012/deploy/webhook-url-here
```

### 3. Sentry Error Tracking

#### SENTRY_AUTH_TOKEN

- **Where to get it:**
  1. Go to [sentry.io](https://sentry.io)
  2. Settings → Account → API → Auth Tokens
  3. Click "Create New Token"
  4. Name: "GitHub Actions"
  5. Scopes needed:
     - `project:releases`
     - `org:read`
  6. Copy the token

#### SENTRY_ORG

- **Where to get it:**
  1. Go to Sentry Settings → Organization Settings
  2. Copy the "Organization Slug"
  3. Usually your organization name in lowercase

### 4. Database for CI Tests

#### TEST_DB_PASSWORD

- **Value:** Any secure password for test database
- **Generate:**
  ```bash
  openssl rand -base64 32
  ```

## Copy-Paste Commands

Use these commands to quickly set up secrets via GitHub CLI:

```bash
# Install GitHub CLI first if needed
# brew install gh (macOS)
# Then authenticate: gh auth login

# Set Vercel secrets
gh secret set VERCEL_TOKEN --body="YOUR_VERCEL_TOKEN"
gh secret set VERCEL_PROJECT_ID --body="YOUR_PROJECT_ID"
gh secret set VERCEL_ORG_ID --body="YOUR_ORG_ID"

# Set Forge secret
gh secret set FORGE_WEBHOOK_URL --body="YOUR_FORGE_WEBHOOK_URL"

# Set Sentry secrets
gh secret set SENTRY_AUTH_TOKEN --body="YOUR_SENTRY_TOKEN"
gh secret set SENTRY_ORG --body="YOUR_SENTRY_ORG"

# Set test database password
gh secret set TEST_DB_PASSWORD --body="$(openssl rand -base64 32)"
```

## Verification Checklist

After adding all secrets, verify:

- [ ] VERCEL*TOKEN (starts with `vercel*`)
- [ ] VERCEL*PROJECT_ID (starts with `prj*`)
- [ ] VERCEL_ORG_ID (random string)
- [ ] FORGE_WEBHOOK_URL (complete URL)
- [ ] SENTRY_AUTH_TOKEN (long random string)
- [ ] SENTRY_ORG (organization slug)
- [ ] TEST_DB_PASSWORD (for CI tests)

## Testing Your Secrets

### Test Vercel Deployment

```bash
# Make a small change to frontend
echo "// test" >> apps/web/src/App.tsx
git add apps/web/src/App.tsx
git commit -m "test: vercel deployment"
git push
# Check Actions tab for deployment status
```

### Test Forge Deployment

```bash
# Trigger webhook manually
curl -X POST $FORGE_WEBHOOK_URL
# Check Forge dashboard for deployment log
```

### Test Sentry Integration

```bash
# This will happen automatically on next deployment
# Check Sentry dashboard for new release
```

## Environment-Specific Secrets

If you have multiple environments, use these naming patterns:

### Production

- `PROD_VERCEL_TOKEN`
- `PROD_FORGE_WEBHOOK_URL`
- `PROD_SENTRY_AUTH_TOKEN`

### Staging

- `STAGING_VERCEL_TOKEN`
- `STAGING_FORGE_WEBHOOK_URL`
- `STAGING_SENTRY_AUTH_TOKEN`

Update your workflows to use the appropriate secrets:

```yaml
env:
  VERCEL_TOKEN: ${{ github.ref == 'refs/heads/main' && secrets.PROD_VERCEL_TOKEN || secrets.STAGING_VERCEL_TOKEN }}
```

## Security Best Practices

1. **Never log secrets** in GitHub Actions
2. **Rotate tokens** every 3-6 months
3. **Use minimal scopes** for tokens
4. **Different tokens** for each environment
5. **Monitor usage** in service dashboards

## Troubleshooting

### "Bad credentials" error

- Token expired or invalid
- Regenerate and update secret

### "Not found" error

- Wrong project/org ID
- Verify IDs in service dashboard

### Deployment not triggering

- Check webhook URL is complete
- Verify branch protection rules
- Check Actions are enabled

### Sentry not receiving data

- Token lacks required scopes
- Organization slug incorrect
- Check project exists

## Complete Secrets List

| Secret Name       | Service | Required | Description               |
| ----------------- | ------- | -------- | ------------------------- |
| VERCEL_TOKEN      | Vercel  | ✅       | Deployment authentication |
| VERCEL_PROJECT_ID | Vercel  | ✅       | Project identifier        |
| VERCEL_ORG_ID     | Vercel  | ✅       | Organization identifier   |
| FORGE_WEBHOOK_URL | Forge   | ✅       | Deployment trigger        |
| SENTRY_AUTH_TOKEN | Sentry  | ✅       | Source map upload         |
| SENTRY_ORG        | Sentry  | ✅       | Organization slug         |
| TEST_DB_PASSWORD  | CI      | ✅       | Test database password    |

## Next Steps

1. ✅ Add all required secrets
2. ✅ Test each integration
3. ✅ Document any custom secrets
4. ✅ Set up secret rotation reminders
5. ✅ Configure branch protection
