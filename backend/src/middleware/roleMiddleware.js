module.exports = {
  requireProfessor: (req, res, next) => {
    if (!req.user || req.user.user_type !== 'professor') {
      return res.status(403).json({ 
        ok: false, 
        error: 'Acceso denegado. Se requieren permisos de profesor.' 
      });
    }
    next();
  },
  
  requireStudent: (req, res, next) => {
    if (!req.user || req.user.user_type !== 'student') {
      return res.status(403).json({ 
        ok: false, 
        error: 'Acceso denegado. Se requieren permisos de alumno.' 
      });
    }
    next();
  }
};
