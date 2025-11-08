const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET;

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'Token requerido' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
    req.user = user; 
    next();
  });
}

// Middleware para validar que el usuario sea administrador
function verificarAdmin(req, res, next) {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'No tienes permisos de administrador' });
  next();
}

module.exports = { verificarToken, verificarAdmin };
  