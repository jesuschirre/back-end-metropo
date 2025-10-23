const express = require("express");
const router = express.Router();
const db = require("../db");

// soli
router.post("/soliCon", async (req, res) => {
  try {
    const {
      usuario_id,
      metodo_pago,
      monto,
      comprobante_pago,
      nombre,
      identificacion,
      nombre_publicidad,
      total_dias,
      direccion
    } = req.body;

    // Validar campos obligatorios
    if (!usuario_id || !metodo_pago || !monto || !comprobante_pago) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    // Verificar si el usuario ya tiene una solicitud pendiente
    const [solicitud] = await db.query(
      "SELECT * FROM solicitudes_cliente WHERE usuario_id = ?",
      [usuario_id]
    );

    if (solicitud.length > 0) {
      return res.status(409).json({ message: "Ya tienes una solicitud" });
    }

    // Insertar solicitud del cliente
    await db.query(
      `INSERT INTO solicitudes_cliente 
      (usuario_id, metodo_pago, comprobante_pago, monto, fecha_solicitud, estado)
      VALUES (?, ?, ?, ?, NOW(), 'pendiente')`,
      [usuario_id, metodo_pago, comprobante_pago, monto]
    );

    // Insertar contrato de publicidad
    // Opción 2: Mejorar la flexibilidad usando variables para campos clave.
    await db.query(
      `INSERT INTO contratos_publicidad 
        (id_anunciante, nombre_anunciante, ruc_dni_anunciante, nombre_sistema_publicitado, 
        duracion_segundos, frecuencia_diaria, total_dias, fecha_inicio, fecha_fin,
        costo_total, forma_pago, estado_contrato, direccion)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), ?, ?, 'activo', ?)`,
      [
        usuario_id,         // 1. id_anunciante
        nombre,             // 2. nombre_anunciante
        identificacion,     // 3. ruc_dni_anunciante
        nombre_publicidad,  // 4. nombre_sistema_publicitado
        30,                 // 5. duracion_segundos (hardcodeado a 30 en el array)
        30,                 // 6. frecuencia_diaria (hardcodeado a 30 en el array)
        total_dias,         // 7. total_dias
        total_dias,         // 8. total_dias (para la función DATE_ADD)
        monto,              // 9. costo_total
        metodo_pago,        // 10. forma_pago
        direccion           // 11. direccion
      ]
    );

    res.status(201).json({
      message: "¡Solicitud enviada correctamente!",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al enviar la solicitud" });
  }
});

module.exports = router;