const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verificarToken, verificarAdmin } = require('../middleware/auth');

// --- NUEVAS IMPORTACIONES PARA EL ENVÍO DE CORREO ---
const fs = require('fs'); // Módulo nativo de Node.js para interactuar con el sistema de archivos
const path = require('path'); // Módulo nativo para construir rutas de archivos de forma segura
const { sendEmail } = require('../utils/mailer'); // Nuestro servicio de correo que creamos

const SECRET_KEY = process.env.JWT_SECRET;

// =================================================================
// RUTA DE REGISTRO - ACTUALIZADA CON ENVÍO DE CORREO
// =================================================================
router.post('/register', async (req, res) => {
  const { nombre, correo, password, rol } = req.body;
  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    // 1. Encriptar la contraseña y crear el usuario en la base de datos
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO usuarios (nombre, correo, password, rol) VALUES (?, ?, ?, ?)',
      [nombre, correo, hashedPassword, rol || 'usuario']
    );

    // --- INICIO DE LA LÓGICA DE ENVÍO DE CORREO ---
    // Este bloque se ejecuta solo si el usuario se creó correctamente.
    try {
        // 2. Construir la ruta al archivo de la plantilla HTML
        const templatePath = path.join(__dirname, '..', 'templates', 'welcomeEmail.html');
        // 3. Leer el contenido de la plantilla
        let htmlContent = fs.readFileSync(templatePath, 'utf8');

        // 4. Personalizar el HTML reemplazando el placeholder con el nombre real del usuario
        htmlContent = htmlContent.replace('{{nombre}}', nombre);
        
        // 5. Llamar a nuestra función para enviar el correo.
        // No usamos 'await' aquí para no hacer esperar al usuario. La respuesta se envía
        // de inmediato y el correo se procesa en segundo plano.
        sendEmail({
            to: correo,
            subject: '¡Bienvenido a Metrópoli E-commerce!',
            htmlContent: htmlContent
        });

    } catch (emailError) {
        // Si hay un error al enviar el correo (ej: la plantilla no se encuentra),
        // lo registramos en la consola del servidor, pero NO le enviamos un error al usuario,
        // ya que su registro en la base de datos fue exitoso.
        console.error("Usuario registrado, pero falló el envío del correo de bienvenida:", emailError);
    }
    // --- FIN DE LA LÓGICA DE ENVÍO DE CORREO ---

    // 6. Enviar una respuesta de éxito al frontend
    res.status(201).json({ message: 'Usuario registrado correctamente' });

  } catch (err) {
    console.error("Error en el endpoint de registro:", err);
    
    // Mejora: Manejar específicamente el error de correo duplicado
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Este correo electrónico ya está en uso.' });
    }
    
    // Error genérico para otros problemas
    res.status(500).json({ error: 'Error interno del servidor al registrar el usuario.' });
  }
});

// =================================================================
// OTRAS RUTAS (SIN CAMBIOS)
// =================================================================

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
      { expiresIn: '1h' }
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