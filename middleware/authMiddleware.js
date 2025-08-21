const jwt = require('jsonwebtoken');

// Guardia 1: Revisa si el token es válido
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado. Se necesita un token.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token no válido o expirado.' });
    }
    req.user = user;
    next();
  });
};

// Guardia 2: Revisa si el usuario es Admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.rol === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Acceso denegado. No tienes permisos de administrador.' });
  }
};

module.exports = { verifyToken, isAdmin };