/**
 * Global error handler - never leak stack in production
 */
const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const isDev = process.env.NODE_ENV !== 'production';

  console.error('[Error]', err.message, isDev ? err.stack : '');

  res.status(status).json({
    success: false,
    message,
    ...(isDev && err.stack && { stack: err.stack }),
  });
};

/**
 * 404 handler for unknown routes
 */
const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
};

module.exports = { errorHandler, notFound };
