# New Project Checklist

When creating a new project from this template, follow this checklist:

## Initial Setup

### 1. Create Repository
- [ ] Click "Use this template" on GitHub
- [ ] Name your repository
- [ ] Choose public or private
- [ ] Click "Create repository"

### 2. Clone and Install
```bash
git clone https://github.com/yourusername/your-project.git
cd your-project
yarn install
```

### 3. Configure Environment
- [ ] Copy environment template: `cp .env.example .env.local`
- [ ] Set MongoDB URI
- [ ] Generate JWT secret: `openssl rand -base64 32`
- [ ] Add API keys (OpenAI, Anthropic, Google AI) if needed

### 4. Initialize Template Tracking
```bash
yarn init-template https://github.com/yourusername/app-template-ai.git
git add .template-sync.json
git commit -m "Initialize template tracking"
```

### 5. Customize Configuration
- [ ] Edit `package.json` - update name, description, author
- [ ] Edit `README.md` - describe your project
- [ ] Update `.template-sync.json` - customize ignored files
- [ ] Review and commit: `git add . && git commit -m "Initial project setup"`

### 6. Test the Project
```bash
# Type check and lint
yarn checks

# Start development server
yarn dev
```

Visit http://localhost:3000 to verify it works!

## Customization

### 7. Update Branding
- [ ] Update `src/app/layout.tsx` - site title and description
- [ ] Update `src/app/manifest.ts` - PWA manifest
- [ ] Replace `public/favicon.ico` with your icon
- [ ] Update theme colors in `tailwind.config.ts` if desired

### 8. Remove Unused Features (Optional)
If you don't need certain features:

```bash
# Remove AI integrations
rm -rf src/server/ai
# Update src/apis/apis.ts to remove AI API registrations

# Remove example APIs
rm -rf src/apis/example
# Update src/apis/apis.ts accordingly
```

### 9. Add Project-Specific Files to Template Config
Edit `.template-sync.json`:
```json
{
  "projectSpecificFiles": [
    "src/client/features/your-custom-feature",
    "src/apis/your-custom-api"
  ]
}
```

## Development Workflow

### 10. Create Your First Feature
```bash
mkdir -p src/client/features/my-feature
cd src/client/features/my-feature
touch index.ts store.ts hooks.ts types.ts
```

See [feature-based-structure](.cursor/rules/feature-based-structure.mdc) for details.

### 11. Add Your First Route
```bash
mkdir -p src/client/routes/MyPage
touch src/client/routes/MyPage/page.tsx
```

See [pages-and-routing-guidelines](.cursor/rules/pages-and-routing-guidelines.mdc) for details.

### 12. Create Your First API
```bash
mkdir -p src/apis/my-api
cd src/apis/my-api
touch index.ts types.ts server.ts client.ts
```

Register it in `src/apis/apis.ts`.

See [client-server-communications](.cursor/rules/client-server-communications.mdc) for details.

## Deployment

### 13. Setup Database
- [ ] Create MongoDB database (local or Atlas)
- [ ] Update `MONGODB_URI` in production environment
- [ ] Test connection

### 14. Deploy to Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### 15. Configure Production Environment
- [ ] Set all environment variables in hosting platform
- [ ] Enable HTTPS
- [ ] Configure custom domain (optional)
- [ ] Test production deployment

## Ongoing Maintenance

### 16. Enable Template Update Checks (Optional)
```bash
# Rename the example workflow file
mv .github/workflows/check-template-updates.yml.example \
   .github/workflows/check-template-updates.yml

# Uncomment the schedule in the file to enable weekly checks
```

### 17. Document Your Changes
- [ ] Update README.md with your project details
- [ ] Document custom features
- [ ] Add setup instructions for team members

### 18. Regular Maintenance
- [ ] Check for template updates monthly: `yarn sync-template --dry-run`
- [ ] Keep dependencies updated: `yarn upgrade-interactive`
- [ ] Run checks before commits: `yarn checks`

## Template Sync Workflow

When template updates are available:

```bash
# 1. Check what's new
yarn sync-template --dry-run

# 2. Ensure clean working directory
git status
git commit -am "WIP: Current work" # if needed

# 3. Sync template
yarn sync-template

# 4. Review changes
git diff

# 5. Resolve conflicts (if any)
# - Review each .template file
# - Manually merge changes
# - Delete .template files

# 6. Test
yarn checks
yarn dev

# 7. Commit
git add .
git commit -m "Merge template updates"
git push
```

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
mongosh

# Or use MongoDB Atlas (cloud)
# Get connection string and update MONGODB_URI
```

### TypeScript Errors
```bash
# Clear Next.js cache
rm -rf .next
yarn dev
```

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 yarn dev
```

## Resources

- 📚 [Template Sync Guide](docs/template-sync/template-sync.md)
- 🏪 [State Management](docs/state-management.md)
- 🎨 [shadcn/ui Components](docs/shadcn-component-library.md)
- 🗄️ [MongoDB Usage](.cursor/rules/mongodb-usage.mdc)
- 📁 [Feature Structure](.cursor/rules/feature-based-structure.mdc)

## Getting Help

- 🐛 [Report Issues](https://github.com/yourusername/app-template-ai/issues)
- 💬 [Discussions](https://github.com/yourusername/app-template-ai/discussions)
- 📖 [Full Documentation](docs/)

---

**Happy coding! 🚀**

Once you've completed this checklist, delete this file or move it to `docs/` for reference.



