const express = require("express");
const router = express.Router();
const db = require("../db"); // Asegúrate que la ruta a tu conexión DB sea correcta
const { encryptPassword } = require("../utils/crypto");

// GET: Obtener toda la configuración de correo
router.get("/correo", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT clave_config, valor_config FROM configuracion_correo"
    );

    const config = rows.reduce((acc, row) => {
      acc[row.clave_config] = row.valor_config;
      return acc;
    }, {});

    // No enviar contraseñas encriptadas al frontend
    delete config.corporativo_contrasena_encriptada;
    delete config.gmail_contrasena_encriptada;

    res.json(config);
  } catch (err) {
    console.error("Error al obtener la configuración de correo:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST: Actualizar la configuración de correo
router.post("/correo", async (req, res) => {
  const newConfig = req.body;
  const connection = await db.getConnection(); 

  try {
    await connection.beginTransaction();

    for (const key in newConfig) {
      if (Object.hasOwnProperty.call(newConfig, key)) {
        let value = newConfig[key];

        // Si el campo de contraseña llega con valor, lo encriptamos. Si llega vacío, no hacemos nada.
        if ((key === 'corporativo_contrasena' || key === 'gmail_contrasena') && value) {
            const encryptedPassword = encryptPassword(value);
            const dbKey = key.replace('_contrasena', '_contrasena_encriptada');
            await connection.query(
                "UPDATE configuracion_correo SET valor_config = ? WHERE clave_config = ?",
                [encryptedPassword, dbKey]
            );
        } else if (key !== 'corporativo_contrasena' && key !== 'gmail_contrasena') {
            await connection.query(
                "UPDATE configuracion_correo SET valor_config = ? WHERE clave_config = ?",
                [value, key]
            );
        }
      }
    }

    await connection.commit();
    res.json({ message: "Configuración guardada correctamente" });
  } catch (err) {
    await connection.rollback();
    console.error("Error al guardar la configuración de correo:", err);
    res.status(500).json({ error: "Error al guardar la configuración" });
  } finally {
    connection.release();
  }
});

module.exports = router;