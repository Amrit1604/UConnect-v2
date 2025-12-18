    # Admin Mode — Quick Guide

This repository includes an Admin Mode with a special unlock sequence you can use anywhere in the app UI.

How to open Admin Mode
- While visiting the website (any page), press the keyboard combo: Ctrl+Shift+Space
- A black eye-blink overlay will animate, and an admin unlock modal will appear
- Enter your admin password (set in the `.env` file as `ADMIN_PASSWORD`) and click `Unlock`

Admin session
- On successful unlock, the server sets a session flag `req.session.isAdmin = true`.
- You will be redirected to `/admin` where you can manage users, posts, reports, and run limited server-side scripts.
- If you prefer, you can access `/admin/login` directly and submit a form with the admin password.

Security notes
- The admin password is read from `.env` as `ADMIN_PASSWORD`. Please keep this secure in your production environment and set it on the host provider instead of committing to source control.
- Admin API endpoints (e.g. `/admin/api/run`) are only accessible to admin sessions or admin users.
- We use `crypto.timingSafeEqual` for password comparison to minimize timing attack risk.

Admin features implemented
- Admin UI (dashboard) with system stats and recent activity
- Manage users (search/filter, activate/deactivate, verify)
- Manage posts (filter, activate/deactivate, clear reports)
- Reports viewing
- Basic analytics (top campuses, recent registration stats)
- Server tools: run `fixCampus` and `testGridFS` scripts from the UI (dangerous, admin-only)

Developer notes
- The admin overlay and modal are implemented in `public/js/admin.js` and `views/partials/admin-modal.ejs`.
- The layout is updated to include admin assets and `res.locals.isAdminSession` is set for templates in `middleware/appMiddleware.js`.
- `middleware/auth.js` includes `requireAdminOrSession` which allows a session admin or an admin role user to access protected `admin` routes.

If you want more admin operations (e.g., batch delete, role management, backup/restore), tell me what you'd like and I'll wire it up.
