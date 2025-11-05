const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/soliCon", async (req, res) => {
  try {
    const {
      cliente_id, plan_id, nombre_campana, fecha_inicio, monto_acordado,
      tipo_contrato, contrato_padre_id, detalles_anuncio, tags, precio_base,
      descuento, dias_emision, anuncios_por_dia, metodo_pago, comprobante_pago
    } = req.body;

    if (!plan_id || !nombre_campana || !fecha_inicio || !monto_acordado) {
      return res.status(400).json({ error: "Faltan campos obligatorios." });
    }

    // Insertar solicitud del cliente
    await db.query(
      `INSERT INTO solicitudes_cliente 
      (usuario_id, metodo_pago, comprobante_pago, monto, fecha_solicitud, estado)
      VALUES (?, ?, ?, ?, NOW(), 'pendiente')`,
      [cliente_id, metodo_pago, comprobante_pago, monto_acordado]
    );

    // Calcular fecha_fin (30 días después)
    const fechaFin = new Date(fecha_inicio);
    fechaFin.setDate(fechaFin.getDate() + 30);

    const diasEmisionJSON = JSON.stringify(dias_emision || []);

    // Insertar contrato publicitario
    const queryContrato = `
      INSERT INTO contratos_publicitarios 
      (cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado,
       estado, tipo_contrato, contrato_padre_id, detalles_anuncio, tags,
       fecha_creacion, fecha_actualizacion, duracion_valor, duracion_unidad,
       pdf_url, precio_base, descuento, dias_emision, anuncios_por_dia)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(queryContrato, [
      cliente_id,                  // 1
      plan_id,                     // 2
      nombre_campana,              // 3
      fecha_inicio,                // 4
      fechaFin.toISOString().slice(0, 10), // 5
      monto_acordado,              // 6
      "Pendiente_Activacion",      // 7
      tipo_contrato,               // 8
      contrato_padre_id || null,   // 9
      detalles_anuncio,            // 10
      tags,                        // 11
      0,                           // 12 duracion_valor
      "dias",                      // 13 duracion_unidad (usa texto)
      null,                        // 14 pdf_url
      parseFloat(precio_base) || 0, // 15
      parseFloat(descuento) || 0,   // 16
      diasEmisionJSON,             // 17
      parseInt(anuncios_por_dia) || 0 // 18
    ]);

    res.status(201).json({
      message: "✅ Solicitud y contrato registrados correctamente. Pendiente de aprobación."
    });

  } catch (err) {
    console.error("Error en /soliCon:", err);
    res.status(500).json({ message: "Error al registrar la solicitud o el contrato." });
  }
});

module.exports = router;