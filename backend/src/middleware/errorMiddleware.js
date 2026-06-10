function notFoundHandler(req, res) {
  res.status(404).json({ ok: false, error: 'Recurso no encontrado.' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    ok: false,
    error: status === 500 ? 'Error interno del servidor.' : error.message
  });
}

module.exports = { notFoundHandler, errorHandler };
