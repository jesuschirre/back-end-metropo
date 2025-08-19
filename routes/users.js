const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verificarToken, verificarAdmin } = require('../middleware/auth');

const SECRET_KEY = process.env.JWT_SECRET;

// REGISTRO
router.post('/register', async (req, res) => {
  const { nombre, correo, password, rol } = req.body;
  if (!nombre || !correo || !password)
    return res.status(400).json({ error: 'Faltan datos' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, ?)',
      [nombre, correo, hashedPassword, rol || 'usuario']
    );
    res.json({ message: 'Usuario registrado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el registro' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password)
    return res.status(400).json({ error: 'Faltan datos' });

  try {
    const [results] = await db.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    if (results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign(
      { id: user.id, correo: user.correo, rol: user.rol },
      SECRET_KEY,
      { expiresIn: '4h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el login' });
  }
});

// GET /users/perfil
router.get('/perfil', verificarToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const [results] = await db.query(
      'SELECT id, nombre, rol, correo FROM usuarios WHERE id = ?',
      [userId]
    );
    if (results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(results[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// PUT /users/perfil
router.put('/perfil', verificarToken, async (req, res) => {
  const userId = req.user.id;
  const { nombre, correo } = req.body;
  try {
    await db.query('UPDATE usuarios SET nombre = ?, correo = ? WHERE id = ?', [nombre, correo, userId]);
    res.json({ message: 'Perfil actualizado con éxito' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// RUTA SOLO PARA ADMIN
router.get('/admin', verificarToken, verificarAdmin, (req, res) => {
  res.json({ message: 'Bienvenido al panel de administrador' });
});

module.exports = router;