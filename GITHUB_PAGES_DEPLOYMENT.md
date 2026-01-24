# GitHub Pages Deployment Setup

## ✅ Completed Changes

All GitHub Pages deployment configuration has been committed to your branch.

### Files Modified:
1. **`vite.config.ts`** - Updated to use `GITHUB_REPOSITORY` env var for base path
2. **`src/App.tsx`** - Added `basename={import.meta.env.BASE_URL}` to BrowserRouter
3. **`public/404.html`** - Updated for SPA refresh support (redirects to index.html)
4. **`.github/workflows/deploy-pages.yml`** - Updated to use `GITHUB_REPOSITORY` and correct env vars

---

## 📍 Deployment URL

**Your GitHub Pages URL will be:**
```
https://gilbertfoust.github.io/hpg-workspace/
```

**Note:** Replace `gilbertfoust` with your actual GitHub username if different.

---

## ✅ Manual Checklist for GitHub UI

### Step 1: Enable GitHub Pages
1. Go to your repository on GitHub: `https://github.com/gilbertfoust/hpg-workspace`
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select:
   - **Source**: `GitHub Actions`
4. Click **Save**

### Step 2: Add Repository Secrets
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add:

   **Secret 1:**
   - **Name**: `VITE_SUPABASE_URL`
   - **Value**: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)

   **Secret 2:**
   - **Name**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: Your Supabase anonymous/public key

3. Click **Add secret** for each

### Step 3: Trigger Deployment
1. Push your changes to the `main` branch (or merge your current branch)
2. Go to **Actions** tab in GitHub
3. The workflow `Deploy Vite site to GitHub Pages` should run automatically
4. Wait for it to complete (check the green checkmark)

### Step 4: Verify Deployment
1. Once the workflow completes, visit: `https://gilbertfoust.github.io/hpg-workspace/`
2. Test deep linking: visit `https://gilbertfoust.github.io/hpg-workspace/dashboard` directly
3. Refresh the page - it should still work (thanks to 404.html fallback)

---

## 🔍 How It Works

1. **Base Path**: Vite uses `/hpg-workspace/` as the base path (from `GITHUB_REPOSITORY` env var)
2. **Router Basename**: React Router uses `import.meta.env.BASE_URL` to match Vite's base
3. **SPA Refresh**: When you refresh a deep link, GitHub Pages serves `404.html`, which redirects to `index.html`, and React Router handles the routing
4. **Environment Variables**: Supabase credentials are injected at build time from GitHub Secrets

---

## 🧪 Local Testing

To test the GitHub Pages build locally:

```bash
# Set the repo name (simulating GitHub Actions)
$env:GITHUB_REPOSITORY="gilbertfoust/hpg-workspace"
npm run build

# Preview the built site
npm run preview
```

**Note:** The build uses `/` as base locally (when `GITHUB_REPOSITORY` is not set), so local preview will work at `http://localhost:4173/`.

---

## 📝 Next Steps

1. ✅ Push/merge to `main` branch
2. ✅ Enable GitHub Pages in Settings
3. ✅ Add Supabase secrets
4. ✅ Wait for workflow to complete
5. ✅ Test the deployed site

---

## 🐛 Troubleshooting

**If deployment fails:**
- Check the **Actions** tab for error messages
- Verify secrets are set correctly (Settings → Secrets)
- Ensure GitHub Pages is enabled (Settings → Pages)

**If deep links don't work:**
- Verify `404.html` exists in `public/` folder
- Check that `BrowserRouter` has `basename` prop set
- Ensure `vite.config.ts` uses `GITHUB_REPOSITORY` for base path

**If assets don't load:**
- Check browser console for 404 errors
- Verify the base path matches your repo name
- Ensure the workflow sets `GITHUB_REPOSITORY` correctly
