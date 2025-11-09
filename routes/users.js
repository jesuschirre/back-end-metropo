const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // Assuming bcryptjs is installed, otherwise use 'bcrypt'
const jwt = require('jsonwebtoken');
const db = require('../db');
// --- CORRECCIÓN AQUÍ ---
// Usamos el archivo y nombres correctos del middleware
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// --- NUEVAS IMPORTACIONES PARA EL ENVÍO DE CORREO (Estaban bien) ---
const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../utils/mailer');

const SECRET_KEY = process.env.JWT_SECRET;

// =================================================================
// RUTA DE REGISTRO - (Sin cambios funcionales, solo corrección de middleware si fuera necesario)
// =================================================================
// NOTA: La ruta de registro público NO debería usar verifyToken ni isAdmin
router.post('/register', async (req, res) => {
  const { nombre, correo, password, rol } = req.body;
  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    // Asegurarse de que el rol por defecto sea 'cliente' si aplica a tu lógica
    await db.query(
      'INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, ?)',
      [nombre, correo, hashedPassword, rol || 'cliente'] // O 'usuario' si prefieres
    );

    try {
      const templatePath = path.join(__dirname, '..', 'templates', 'welcomeEmail.html');
      let htmlContent = fs.readFileSync(templatePath, 'utf8');
      htmlContent = htmlContent.replace('{{nombre}}', nombre);
      sendEmail({
        to: correo,
        subject: '¡Bienvenido a Metrópoli!', // Asunto genérico
        htmlContent: htmlContent
      });
    } catch (emailError) {
      console.error("Usuario registrado, pero falló el envío del correo de bienvenida:", emailError);
    }

    res.status(201).json({ message: 'Usuario registrado correctamente' });

  } catch (err) {
    console.error("Error en el endpoint de registro:", err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Este correo electrónico ya está en uso.' });
    }
    res.status(500).json({ error: 'Error interno del servidor al registrar el usuario.' });
  }
});

// =================================================================
// RUTA DE LOGIN (Sin cambios)
// =================================================================
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
      { expiresIn: '4h' } // Considera un tiempo mayor si es necesario
    );

    res.json({
      message: 'Login exitoso',
      token,
      // Devuelve solo la info necesaria para el frontend
      user: {
          id: user.id,
          nombre: user.nombre,
          correo: user.correo,
          rol: user.rol
      }
    });

  } catch (err) {
    console.error("Error en el login:", err);
    res.status(500).json({ error: 'Error interno del servidor en el login' });
  }
});

// =================================================================
// --- NUEVA RUTA: GET /users ---
// Para obtener la lista de usuarios (ej: para el dropdown de contratos)
// =================================================================
// PROTEGIDA: Solo usuarios logueados pueden ver la lista
router.get('/', verifyToken, async (req, res) => {
    // Si quisieras que solo admins vean la lista completa, añade isAdmin aquí:
    // router.get('/', verifyToken, isAdmin, async (req, res) => {
    try {
        // Devuelve todos los usuarios. Puedes filtrar roles si es necesario
        // Por ejemplo: WHERE rol IN ('cliente', 'vendedor', 'locutor')
        const [rows] = await db.query(
            "SELECT id, nombre, correo, rol FROM usuarios ORDER BY nombre ASC"
        );
        res.json(rows);
    } catch (err) {
        console.error("Error al obtener la lista de usuarios:", err);
        res.status(500).json({ error: "Error interno del servidor al obtener usuarios" });
    }
});


// =================================================================
// RUTAS DE PERFIL - ACTUALIZADAS CON MIDDLEWARE CORRECTO
// =================================================================

// GET /users/perfil
// --- CORRECCIÓN AQUÍ ---
router.get('/perfil', verifyToken, async (req, res) => {
  // El ID del usuario viene del token verificado (req.user.id)
  const userId = req.user.id;
  try {
    const [results] = await db.query(
      'SELECT * FROM usuarios WHERE id = ?',
      [userId]
    );
    if (results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(results[0]);
  } catch (err) {
    console.error("Error al obtener perfil:", err);
    res.status(500).json({ error: 'Error interno del servidor al obtener perfil' });
  }
});

// PUT /users/perfil
// --- CORRECCIÓN AQUÍ ---
router.put('/perfil', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { nombre, correo, tipo_documento, numero_documento, direccion, biografia, telefono } = req.body;

  // Validación básica
  if (!nombre || !correo) {
      return res.status(400).json({ error: 'Nombre y correo son requeridos.' });
  }

  try {
    const [result] = await db.query('UPDATE usuarios SET nombre = ?, correo = ?, tipo_documento = ?, numero_documento = ?, direccion = ?, biografia = ?, telefono = ? WHERE id = ?', 
      [nombre, correo, tipo_documento , numero_documento, direccion, biografia, telefono,  userId]);

    if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado para actualizar.' });
    }
    // Devuelve el perfil actualizado (opcional pero útil)
     const [updatedUser] = await db.query('SELECT id, nombre, rol, correo FROM usuarios WHERE id = ?', [userId]);
    res.json({ message: 'Perfil actualizado con éxito', user: updatedUser[0] });
  } catch (err) {
    console.error("Error al actualizar perfil:", err);
     if (err.code === 'ER_DUP_ENTRY') { // Manejar correo duplicado
         return res.status(409).json({ error: 'El correo electrónico ya está en uso por otro usuario.' });
     }
    res.status(500).json({ error: 'Error interno del servidor al actualizar perfil' });
  }
});

router.get("/contra_usu", async ( req , res ) => {
    try {
      const { id_usu} = req.body  
    } catch (error) {
      
    }
})

// =================================================================
// RUTA SOLO PARA ADMIN - ACTUALIZADA CON MIDDLEWARE CORRECTO
// =================================================================
router.get('/admin-test', verifyToken, isAdmin, (req, res) => {
  res.json({ message: 'Acceso concedido. Eres un administrador.' });
});

module.exports = router;