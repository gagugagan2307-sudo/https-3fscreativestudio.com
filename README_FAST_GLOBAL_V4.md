# 3FS Fast Global Realtime V4

- Supabase project: existing 3FS project
- Authentication: anonymous session for the shared database layer
- Global save: atomic `threefs_merge_state` RPC; only changed dashboard sections are sent
- Realtime: `threefs_state` Postgres Changes
- Mobile: hard override removes the desktop sidebar/yellow-column layout below 900px
- Teams: Edit + Customise selected team; custom fields are shared globally

Upload all files together. Do not mix V4 files with older versions.
