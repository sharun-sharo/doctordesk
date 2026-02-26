# Deploy DoctorDesk backend on Railway

## 1. Backend service

- **Root Directory:** Set to `backend` in the service **Settings → Source**.
- **Variables:** Add `NODE_ENV=production`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `FRONTEND_URL`.

## 2. MySQL database

- In the same project, add **+ New → Database → MySQL**.
- In the MySQL service, open **Variables** (or **Connect**) and note: `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT` (names may vary).

## 3. Connect backend to MySQL

In the **doctordesk** (backend) service → **Variables**:

- Add variables that **reference** the MySQL service, or copy values:
  - `DB_HOST` = MySQL host
  - `DB_PORT` = `3306` (or value from MySQL)
  - `DB_USER` = MySQL user
  - `DB_PASSWORD` = MySQL password
  - `DB_NAME` = MySQL database name

## 4. Load schema into the empty MySQL (one time)

Railway’s MySQL starts with no tables. Run the setup script **from your machine** with the **Railway MySQL** credentials.

1. From the MySQL service in Railway, copy **Connect** details or **Variables**: host, port, user, password, database.
2. In your terminal (from the repo root):

```bash
cd backend
DB_HOST=your_railway_mysql_host \
DB_PORT=3306 \
DB_USER=your_railway_mysql_user \
DB_PASSWORD=your_railway_mysql_password \
DB_NAME=railway \
node scripts/runFullSetup.js
```

Replace the values with the ones from Railway. If Railway uses a different port or database name, set `DB_PORT` and `DB_NAME` accordingly.

3. Optional: seed a super admin (set your own email/password):

```bash
SEED_SUPER_ADMIN_EMAIL=admin@yourclinic.com \
SEED_SUPER_ADMIN_PASSWORD=YourSecurePassword \
node scripts/seed.js
```

4. Optional: add demo data for **admin@doctordesk.com** (patients, appointments, prescriptions, invoices):

```bash
# Same DB_* env as above
node scripts/seedDemoData.js
# or: npm run seed:demo
```

Log in as `admin@doctordesk.com` / `Admin@123` to see the demo data.

### Add Assistant doctor role (if you get “foreign key constraint fails” on Add User)

If adding a user with role “Assistant doctor” fails in production, the `roles` table is missing id 5. From your machine, with the same Railway DB credentials (e.g. in `backend/.env` or inline):

```bash
cd backend
node scripts/addAssistantDoctorRole.js
```

Or with inline env (replace with your Railway MySQL values):

```bash
cd backend
DB_HOST=your_railway_mysql_host DB_PORT=3306 DB_USER=your_user DB_PASSWORD=your_password DB_NAME=your_db node scripts/addAssistantDoctorRole.js
```

## 5. Redeploy backend

After variables and schema are set, **Redeploy** the backend service. It should start without “Database connection failed”.

## 6. Frontend

Deploy the frontend (e.g. Vercel/Netlify) with **`VITE_API_URL`** set to your Railway backend URL (e.g. `https://your-app.up.railway.app/api/v1`). This is required at **build time**—without it, users will see "Network error" on login because the app will try to call localhost. In Vercel: Project → Settings → Environment Variables → add `VITE_API_URL` = your Railway API URL including `/api/v1`, then redeploy. Set `FRONTEND_URL` on Railway to your frontend URL (e.g. `https://doctordesk.me`).
