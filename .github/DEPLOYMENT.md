# Vercel Deployment Setup

This repository is configured to automatically deploy to Vercel production on every push to the `master` branch.

## Required GitHub Secrets

To enable automatic deployments, you need to configure the following secrets in your GitHub repository settings:

1. **VERCEL_TOKEN**
   - Go to Vercel Dashboard → Settings → Tokens
   - Create a new token with appropriate permissions
   - Add it to GitHub: Settings → Secrets and variables → Actions → New repository secret

2. **VERCEL_ORG_ID**
   - Found in Vercel project settings
   - Or run `vercel link` locally and check `.vercel/project.json`

3. **VERCEL_PROJECT_ID**
   - Found in Vercel project settings
   - Or run `vercel link` locally and check `.vercel/project.json`

## Manual Deployment

To manually trigger a deployment:

\`\`\`bash
# Install Vercel CLI
bun add -g vercel

# Deploy to production
vercel --prod
\`\`\`

## Workflow

The deployment workflow:
1. Runs on every push to `master` branch
2. Installs dependencies with Bun
3. Runs linter and tests
4. Builds the project
5. Deploys to Vercel production

See `.github/workflows/deploy.yml` for the full workflow configuration.
