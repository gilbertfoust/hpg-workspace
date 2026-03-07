# HPG Workstation — Org Coordination OS

A comprehensive organizational coordination system for managing NGO relationships, work items, documents, approvals, and cross-departmental workflows.

## Project Info

**Live URL**: https://hpg-workspace.lovable.app  
**Preview URL**: https://id-preview--b124dc6a-4095-4aa4-a2a8-11419602e543.lovable.app

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Lovable Cloud (Supabase-powered)
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6

## Environment Variables

The application requires the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ Yes | Backend API URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Public anon key for client-side auth |

### For Edge Functions Only (Server-Side)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Service role key for admin operations (never expose client-side) |

> ⚠️ **Security**: Never commit secrets to the repository. All secrets are managed via Lovable Cloud.

## Local Development

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd hpg-workspace

# Install dependencies
npm install

# Create a .env file (copy from .env.example if available)
# Or the Lovable Cloud will auto-inject environment variables

# Start development server
npm run dev
```

The app will be available at `http://localhost:8080`

## Deployment

This project is deployed via **Lovable Cloud**, which provides:
- Automatic deployments on push to main branch
- Managed backend infrastructure
- Automatic SSL certificates
- Environment variable management

### Manual Deployment Steps

1. Push changes to the `main` branch
2. Lovable Cloud automatically builds and deploys
3. Visit the live URL to verify changes

### Verifying Configuration

1. Log in to the application
2. Navigate to **Admin → Settings**
3. Check the **Configuration Status** panel
4. All environment variables should show "Present"

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `ngos` | NGO organizations being coordinated |
| `work_items` | Tasks, deliverables, and action items |
| `documents` | File metadata and review status |
| `contacts` | People associated with NGOs |
| `org_units` | Internal departments/teams |
| `profiles` | User profile information |
| `user_roles` | Role-based access control |
| `approvals` | Approval workflow records |
| `audit_log` | Change tracking for compliance |
| `form_templates` | Dynamic form definitions |
| `form_submissions` | Submitted form data |
| `template_groups` | Work item template bundles |
| `comments` | Work item discussions |

### User Roles

| Role | Access Level |
|------|--------------|
| `super_admin` | Full system access |
| `admin_pm` | Administrative oversight |
| `executive_secretariat` | Executive-level access |
| `ngo_coordinator` | Assigned NGO management |
| `department_lead` | Department-scoped access |
| `staff_member` | Basic staff access |
| `external_ngo` | External NGO user (limited) |

## Row-Level Security (RLS)

All tables have RLS policies enforcing:
- Users see only data they're authorized to access
- Super admins have unrestricted access
- Department leads see department-scoped data
- NGO coordinators see assigned NGO data
- External users see only their linked NGO data

## Project Structure

```
src/
├── components/
│   ├── admin/          # Admin panel components
│   ├── auth/           # Authentication components
│   ├── common/         # Shared UI components
│   ├── layout/         # Layout components
│   ├── ngo/            # NGO-related components
│   ├── ui/             # shadcn/ui primitives
│   └── work-items/     # Work item components
├── contexts/           # React contexts (Auth)
├── hooks/              # Custom React hooks
├── integrations/       # External integrations
├── lib/                # Utility functions
└── pages/              # Route pages
```

## GitHub OAuth Setup

This application supports GitHub OAuth authentication via Supabase. To enable GitHub sign-in:

### 1. Supabase Dashboard Configuration

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Enable **GitHub** provider
4. Enter your GitHub OAuth App credentials:
   - **Client ID**: From your GitHub OAuth App
   - **Client Secret**: From your GitHub OAuth App

### 2. Supabase URL Configuration

In **Authentication** → **URL Configuration**:

- **Site URL**: `https://<your-username>.github.io/<repo-name>/`
  - Example: `https://gilbertfoust.github.io/hpg-workspace/`
  
- **Redirect URLs** (add these to the allow-list):
  - `https://<your-username>.github.io/<repo-name>/`
  - `https://<your-username>.github.io/<repo-name>/*`

### 3. GitHub OAuth App Configuration

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Create a new OAuth App or edit existing one
3. Set the following:
   - **Homepage URL**: `https://<your-username>.github.io/<repo-name>/`
   - **Authorization callback URL**: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
     - Replace `<PROJECT_REF>` with your Supabase project reference ID
     - You can find this in your Supabase project URL: `https://<PROJECT_REF>.supabase.co`
4. **Important**: Keep "Enable Device Flow" **OFF** for web SPA applications

### 4. Environment Variables

Ensure these are set in GitHub Actions secrets (already configured):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

These are automatically injected during the build process.

## Testing the Live Site

### Phase 1 Verification Checklist

- [ ] Auth page loads at `/auth`
- [ ] Sign up creates a new account
- [ ] Sign in works with valid credentials
- [ ] **GitHub OAuth sign-in works and redirects correctly**
- [ ] **OAuth callback route (`/auth/callback`) works without 404**
- [ ] Session persists on page refresh
- [ ] Sign out clears session
- [ ] Protected routes redirect to `/auth`
- [ ] **Deep routes refresh correctly (no 404 on GitHub Pages)**
- [ ] Admin → Settings shows Config Status panel
- [ ] All environment variables show "Present"

## Contributing

1. Make changes incrementally
2. Never break the existing build
3. Hide incomplete features behind "Coming Soon" flags
4. Use migration-first approach for database changes
5. Never commit secrets

## License

Proprietary - HPG Internal Use Only
