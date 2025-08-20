const express = require("express");
const router = express.Router();
const db = require("../db"); // Asegúrate que la ruta a tu conexión DB sea correcta
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// RUTA: POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({ message: "Correo y contraseña son requeridos." });
    }

    // Busca un usuario en tu tabla `usuarios` que coincida con el correo
    const [[usuario]] = await db.query("SELECT * FROM usuarios WHERE correo = ?", [correo]);

    // Si no encuentra a nadie, devuelve un error
    if (!usuario) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }

    // ¡La parte MÁGICA! Compara la contraseña que el usuario escribió (ej: "12345")
    // con la contraseña encriptada de tu base de datos (ej: "$2b$10$beAvTb...")
    const esPasswordCorrecto = await bcrypt.compare(password, usuario.password);

    // Si la comparación falla, devuelve un error
    if (!esPasswordCorrecto) {
      return res.status(401).json({ message: "Credenciales inválidas." });
    }
    
    // Si todo es correcto, creamos el "pase de acceso" (token)
    // con los datos del usuario que sí pudo entrar.
    const payload = {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
    };

    // Firmamos el token usando el secreto de tu archivo .env
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" });

    // Enviamos la respuesta de éxito
    res.json({
      message: `Bienvenido de nuevo, ${usuario.nombre}`,
      token: token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
      },
    });

  } catch (error) {
    console.error("Error en el login:", error);
    res.status(500).json({ message: "Error interno del servidor." });
  }
});

module.exports = router;