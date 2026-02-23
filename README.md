# Doctor Desk

Production-ready web application for managing a small clinic: patients, appointments, billing, prescriptions, inventory, and reports. Built with **React (Vite) + Tailwind CSS** frontend and **Node.js + Express.js** backend, **MySQL** database, **JWT** authentication, and **RBAC**.

---

## Tech Stack

| Layer    | Technology        |
|----------|-------------------|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Axios, Recharts, React Hot Toast |
| Backend  | Node.js, Express.js |
| Database | MySQL (GoDaddy-compatible) |
| Auth     | JWT (access + refresh), bcrypt |
| Security | Helmet, CORS, rate limiting, express-validator |

---

## Quick Start (Local)

### 1. Database

- Create a MySQL database (e.g. `clinic_management`).
- Run the schema:
  - **Option A:** Import `database/schema.sql` via phpMyAdmin or MySQL client.
  - **Option B:** From project root: `cd backend && npm run migrate` (after setting `.env`).

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
npm install
npm run seed    # Creates Super Admin: admin@clinic.com / SuperAdmin@123
npm run dev     # http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Optional: set VITE_API_URL=http://localhost:5000/api/v1 if not using Vite proxy
npm install
npm run dev     # http://localhost:5173
```

- Open http://localhost:5173 and log in with **admin@clinic.com** / **SuperAdmin@123** (change password after first login).

---

## Project Structure

```
DoctorDesk/
├── backend/
│   ├── config/          # database, roles
│   ├── controllers/      # auth, users, patients, appointments, invoices, etc.
│   ├── middleware/       # auth, RBAC, validate, errorHandler
│   ├── routes/           # API routes
│   ├── scripts/          # seed.js, runSchema.js
│   ├── utils/            # activityLogger, invoiceNumber
│   ├── validators/       # express-validator rules
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/          # axios instance
│   │   ├── components/    # Modal, Spinner
│   │   ├── context/       # AuthContext
│   │   ├── layout/       # Layout, sidebar
│   │   ├── pages/         # all screens
│   │   └── main.jsx, App.jsx, index.css
│   ├── index.html
│   └── package.json
├── database/
│   └── schema.sql        # Full MySQL schema + roles seed
├── docs/
│   ├── API.md            # API documentation
│   └── DEPLOYMENT.md     # GoDaddy / cPanel deployment
├── postman/
│   └── Clinic-Management-API.postman_collection.json
└── README.md
```

---

## User Roles & Access

| Role           | Capabilities |
|----------------|--------------|
| **Super Admin**| Full access; **view all clinics**; create/edit/delete Admins, Doctors, Receptionists; activity logs, login history, revenue & doctor reports. |
| **Admin**      | Dashboard, reports, **book appointments**; manage doctors & staff; manage appointments. Same dashboard/report view as doctor-level access. Cannot create Super Admin. |
| **Doctor**     | Dashboard, own appointments, update patient records, add prescriptions, view medical history. |
| **Receptionist** | **Book appointments**; register patients; generate bills; dashboard and inventory. |

---

## Environment Variables

### Backend (`.env`)

- `NODE_ENV`, `PORT`, `API_PREFIX`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`
- `FRONTEND_URL` (for CORS and password reset link)
- Optional: `SMTP_*`, `MAIL_FROM` for forgot password email
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`

### Frontend (`.env`)

- `VITE_API_URL` – Backend API base URL (e.g. `http://localhost:5000/api/v1` or production URL including `/api/v1`).

---

## Scripts

| Command        | Description |
|----------------|-------------|
| `npm run migrate` (backend) | Run `database/schema.sql` |
| `npm run seed` (backend)    | Create Super Admin (overridable via `SEED_SUPER_ADMIN_*` env) |
| `npm run dev` (backend)    | Start API with nodemon |
| `npm start` (backend)      | Start API (production) |
| `npm run dev` (frontend)    | Start Vite dev server |
| `npm run build` (frontend) | Production build |

---

## API Overview

- Base path: `/api/v1`
- Auth: `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`
- Protected routes use `Authorization: Bearer <accessToken>`
- See `docs/API.md` and `postman/` collection for full list.

---

## Deployment (GoDaddy / cPanel)

See **docs/DEPLOYMENT.md** for:

- Backend build and PM2
- Connecting to remote MySQL
- Folder structure on cPanel
- Step-by-step deployment

---

## License

ISC.
# doctordesk
