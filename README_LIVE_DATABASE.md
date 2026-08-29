# 3FS Final Website — Real-Time Database Edition

This version keeps the existing 3FS dashboard and adds a real-time shared database layer using Supabase.

### Live features
- Shared Clients, Projects, Teams, Services, Partners, Enquiries and Calendar data
- Realtime updates across multiple open devices/browsers
- Automatic local fallback when Supabase is not configured
- Live connection indicator in the dashboard header
- First connected device seeds the database when the shared row is empty
- Every save is pushed to Supabase automatically

### Supabase setup
1. Create a Supabase project.
2. In **Authentication → Providers**, enable **Email** sign-in (password).
3. Open the Supabase SQL Editor and run `database.sql`.
4. Put your Supabase project URL and **publishable/anon browser key** in `supabase-config.js`.
5. Upload all website files to the same hosting folder.
6. Open the site on two devices. Edit a project/client on one device and the other dashboard should update automatically.

### Security
Do not put a Supabase secret/service-role key in browser files. The included SQL uses authenticated access with individual team accounts and server-side role-based permissions.


### Authentication upgrade
The old anonymous-login approach has been removed. The production version requires a real Supabase Auth account and an active profile. See `database.sql` for RLS and role setup.
