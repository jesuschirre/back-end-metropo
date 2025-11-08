const jwt = require('jsonwebtoken');

// Guardia 1: Revisa si el token es válido (Esta ya estaba bien)
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

// Guardia 2: Revisa si el usuario es Admin (Esta ya estaba bien)
const isAdmin = (req, res, next) => {
  if (req.user && req.user.rol === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Acceso denegado. No tienes permisos de administrador.' });
  }
};

// ===================================================================
// --- AÑADE ESTAS DOS NUEVAS FUNCIONES AQUÍ ---
// ===================================================================

// Guardia 3: Revisa si el usuario es Locutor
const isLocutor = (req, res, next) => {
  if (req.user && req.user.rol === 'locutor') {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Locutor.' });
  }
};

// Guardia 4: Revisa si el usuario es Locutor O Administrador
const isLocutorOrAdmin = (req, res, next) => {
  if (req.user && (req.user.rol === 'locutor' || req.user.rol === 'admin')) {
    next();
  } else {
    res.status(403).json({ error: "Acceso denegado. Se requiere rol de Locutor o Administrador." });
  }
};


// ===================================================================
// --- ¡CAMBIO FINAL Y MÁS IMPORTANTE! ---
// Asegúrate de exportar TODAS las funciones.
// ===================================================================
module.exports = { 
  verifyToken, 
  isAdmin,
  isLocutor,        // <-- Añade esta
  isLocutorOrAdmin  // <-- Añade esta
};