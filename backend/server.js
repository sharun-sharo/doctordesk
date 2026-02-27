require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { testConnection } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = [
  frontendOrigin,
  'https://doctordesk-three.vercel.app', // production frontend (fallback if FRONTEND_URL unset)
  'https://doctordesk.me',
  'https://www.doctordesk.me',
  'http://doctordesk.me',
  'http://www.doctordesk.me',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
].filter((o, i, a) => a.indexOf(o) === i);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === 'doctordesk.me' || host.endsWith('.doctordesk.me')) return true;
  } catch (_) {}
  return false;
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) {
        cb(null, origin || true);
      } else {
        cb(null, false);
      }
    },
    credentials: true,
  })
);

const isDev = process.env.NODE_ENV !== 'production';
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || (isDev ? 1000 : 100),
  message: { success: false, message: 'Too many requests' },
});
app.use(API_PREFIX, limiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check (include feature flag so you can confirm deployed code has assigned_admin_id fallback)
app.get('/health', (req, res) =>
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    features: { assignedAdminIdFallback: true },
  })
);

// Static uploads (e.g. clinic logo at /api/v1/uploads/clinic/logo.png)
app.use(`${API_PREFIX}/uploads`, express.static(path.join(process.cwd(), 'uploads')));

// API routes
app.use(API_PREFIX, routes);

// 404 and error handler
app.use(notFound);
app.use(errorHandler);

// Start server after DB check
const start = async () => {
  const dbOk = await testConnection();
  if (!dbOk) {
    console.error('Exiting: database connection failed. Check .env and MySQL.');
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} | API: ${API_PREFIX}`);
  });
};

start().catch((err) => {
  console.error('Startup error:', err);
  process.exit(1);
});
