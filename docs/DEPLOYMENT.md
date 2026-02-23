# Deployment Guide – GoDaddy Shared Hosting (cPanel)

This guide covers deploying Doctor Desk on GoDaddy shared hosting with cPanel, using Node.js and MySQL.

---

## Prerequisites

- GoDaddy hosting with **Node.js** and **MySQL** (e.g. shared hosting that supports Node or a VPS).
- If your plan does not support Node.js, you may need to use **GoDaddy VPS** or deploy backend elsewhere (e.g. Railway, Render) and only host the frontend on GoDaddy.

---

## 1. Database (MySQL on GoDaddy)

1. Log in to **cPanel** → **MySQL Databases**.
2. Create a new database (e.g. `youruser_clinic`).
3. Create a database user and assign a strong password.
4. Add the user to the database with **ALL PRIVILEGES**.
5. Note: **Host** is often `localhost` (cPanel shows it, e.g. `youruser.mysql.db` or `localhost`).
6. Import the schema:
   - **phpMyAdmin** → select your database → **Import** → choose `database/schema.sql` → Execute.
   - Or run the SQL file via command line if you have SSH:
     ```bash
     mysql -u youruser -p youruser_clinic < database/schema.sql
     ```

---

## 2. Backend Deployment

### Option A: cPanel with Node.js (if available)

1. Upload the **entire project** (or at least `backend/` and `database/`) to your hosting, e.g. via File Manager or FTP into `~/clinic-app/`.
2. Create `.env` in `backend/` (see below). Do **not** commit `.env` to git.
3. In cPanel, open **Setup Node.js App** (or equivalent):
   - Application root: `clinic-app/backend` (or path to folder containing `server.js`).
   - Node version: 18.x or 20.x.
   - Application startup file: `server.js`.
   - Application URL: e.g. `https://yourdomain.com/api` (or a subdomain like `api.yourdomain.com`).
4. Install dependencies and run seed:
   - In the Node.js app shell or SSH:
     ```bash
     cd ~/clinic-app/backend
     npm install --production
     npm run seed
     ```
5. Start/restart the application from cPanel.

### Option B: VPS / PM2 (recommended for production)

1. On your VPS (or GoDaddy VPS), clone or upload the project.
2. Install Node.js 18+ and MySQL client if needed.
3. In `backend/`:
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with production values (see below)
   npm install --production
   npm run migrate   # or import schema.sql manually
   npm run seed
   ```
4. Use **PM2** to run the backend:
   ```bash
   npm install -g pm2
   pm2 start server.js --name clinic-api
   pm2 save
   pm2 startup   # follow instructions to enable on boot
   ```
5. Use **Nginx** (or Apache) as reverse proxy to `http://127.0.0.1:5000` (or your `PORT`).

---

## 3. Backend `.env` (Production)

```env
NODE_ENV=production
PORT=5000
API_PREFIX=/api/v1

# GoDaddy MySQL (use the host cPanel shows, often not localhost)
DB_HOST=youruser.mysql.db
DB_PORT=3306
DB_USER=youruser_dbuser
DB_PASSWORD=your_strong_password
DB_NAME=youruser_clinic

JWT_ACCESS_SECRET=your_long_random_access_secret
JWT_REFRESH_SECRET=your_long_random_refresh_secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Your frontend URL (for CORS and password reset links)
FRONTEND_URL=https://yourdomain.com

# Optional: email for forgot password
# SMTP_HOST=...
# SMTP_PORT=587
# SMTP_USER=...
# SMTP_PASS=...
# MAIL_FROM=noreply@yourdomain.com

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

- Replace `DB_*` with the values from cPanel MySQL.
- Generate strong random strings for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

---

## 4. Frontend Build & Hosting

1. Set the API URL for production:
   ```bash
   cd frontend
   echo "VITE_API_URL=https://yourdomain.com/api/v1" > .env.production
   # Or use your API subdomain: https://api.yourdomain.com/api/v1
   ```
2. Build:
   ```bash
   npm install
   npm run build
   ```
3. Upload the contents of `frontend/dist/` to your web root (e.g. `public_html/`) via cPanel File Manager or FTP.
4. Configure your domain so that all routes (e.g. `/login`, `/patients`) are served by `index.html` (single-page app). In cPanel, if using Apache, add a `.htaccess` in `public_html/`:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

---

## 5. Folder Structure on Server (reference)

```
home/youruser/
├── clinic-app/
│   ├── backend/
│   │   ├── .env
│   │   ├── server.js
│   │   ├── package.json
│   │   └── ...
│   ├── database/
│   │   └── schema.sql
│   └── ...
└── public_html/          # or subdomain docroot
    ├── index.html
    ├── assets/
    └── ... (Vite build output)
```

---

## 6. Post-Deployment Checklist

- [ ] MySQL schema imported and seed run (Super Admin created).
- [ ] Backend `.env` set with production DB and JWT secrets.
- [ ] Backend starts without errors (check PM2 or cPanel Node app logs).
- [ ] Frontend `VITE_API_URL` points to the live API (including `/api/v1`).
- [ ] CORS: `FRONTEND_URL` in backend matches the frontend origin.
- [ ] Login with Super Admin and change default password.
- [ ] HTTPS enabled for frontend and API (via cPanel SSL or proxy).

---

## 7. Troubleshooting

- **DB connection failed:** Check `DB_HOST` (often not `localhost` on GoDaddy), user, password, and that the user has access to the database.
- **CORS errors:** Ensure `FRONTEND_URL` in backend exactly matches the origin (protocol + domain + port).
- **404 on refresh:** Ensure SPA rewrite rule is in place so all requests serve `index.html`.
- **PDF download / API 401:** Frontend must send `Authorization: Bearer <token>`; the app uses localStorage and axios interceptors for this.

For more detail on the API, see `docs/API.md`.
