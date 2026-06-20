# User Access Levels

This matrix defines what each sign-in level can access in HPG Workspace. Enforcement lives in `src/lib/accessControl.ts`, `ProtectedRoute`, and sidebar filtering.

| Role | Dashboard | NGOs | NGO Portal | Work Items | Documents | Finance | HR | Grants / Dev | Reports | Admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Super Admin | Yes | Yes | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Admin | Yes | Yes | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Department Lead | Yes | Yes | No | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Staff | Yes | Yes | No | Yes | Yes | Yes | Yes | Yes | Yes | No |
| NGO Coordinator | Yes | Yes | No | Yes | Yes | No | No | No | No | No |
| NGO User | No | No | Yes | Portal only | Portal only | No | No | No | No | No |
| Viewer / Board | Yes | No | No | No | No | No | No | No | Yes | No |

## Notes

- NGO portal roles are redirected to `/portal` and cannot access internal routes.
- Admin console (`/admin`) requires `super_admin` or `admin_pm`.
- Role assignment is limited to Super Admin and Admin via the Admin Console Users tab.
- VP roles inherit department-scoped access aligned with their lane (finance VPs → finance hub, etc.).

See proposed schema changes in `docs/proposed-schemas/user-access-bundle-schemas.md` for calendar events, upload notifications, potential sponsees, and profile avatar storage.
