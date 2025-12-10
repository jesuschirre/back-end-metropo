const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/soliCon", async (req, res) => {
  try {
    const {
      cliente_id,
      plan_id,
      nombre_campana,
      fecha_inicio,
      monto_acordado,
      tipo_contrato,
      contrato_padre_id,
      detalles_anuncio,
      tags,
      precio_base,
      descuento,
      dias_emision,
      anuncios_por_dia,
      metodo_pago,
      comprobante_pago
    } = req.body;

    // VALIDACIÓN BÁSICA
    if (!cliente_id || !plan_id || !nombre_campana || !fecha_inicio || !monto_acordado) {
      return res.status(400).json({ message: "Faltan campos obligatorios." });
    }

    // VALIDAR FECHA
    const fechaInicioObj = new Date(fecha_inicio);
    if (isNaN(fechaInicioObj)) {
      return res.status(400).json({ message: "Fecha de inicio inválida." });
    }

    // CALCULAR FECHA FIN
    const fechaFinObj = new Date(fechaInicioObj);
    fechaFinObj.setDate(fechaFinObj.getDate() + 30);

    // MANEJAR CONTRATO PADRE
    const contratoPadre = (!contrato_padre_id || contrato_padre_id === "null") ? null : contrato_padre_id;

    // ASEGURAR JSON EN DIAS_EMISION
    let diasEmisionJSON = "[]";

    if (Array.isArray(dias_emision)) {
      diasEmisionJSON = JSON.stringify(dias_emision);
    } else if (typeof dias_emision === "string") {
      try {
        diasEmisionJSON = JSON.stringify(JSON.parse(dias_emision));
      } catch (e) {
        diasEmisionJSON = "[]";
      }
    }

    // INSERT CONTRATO
    const [resultadoContrato] = await db.query(
      `INSERT INTO contratos_publicitarios 
      (cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado,
       estado, tipo_contrato, contrato_padre_id, detalles_anuncio, tags,
       fecha_creacion, fecha_actualizacion, duracion_valor, duracion_unidad,
       pdf_url, precio_base, descuento, dias_emision, anuncios_por_dia)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?)`,
      [
        cliente_id,
        plan_id,
        nombre_campana,
        fecha_inicio,
        fechaFinObj.toISOString().slice(0, 10),
        monto_acordado,
        "Pendiente_Activacion",
        tipo_contrato,
        contratoPadre,
        detalles_anuncio || null,
        tags || null,
        30,                 
        "dias",             
        null,               
        parseFloat(precio_base) || 0,
        parseFloat(descuento) || 0,
        diasEmisionJSON,
        parseInt(anuncios_por_dia) || 0
      ]
    );

    const contratoId = resultadoContrato.insertId;

    // INSERT SOLICITUD DEL CLIENTE
    await db.query(
      `INSERT INTO solicitudes_cliente 
      (usuario_id, metodo_pago, comprobante_pago, monto, fecha_solicitud, estado, idContrato)
      VALUES (?, ?, ?, ?, NOW(), 'pendiente', ?)`,
      [
        cliente_id,
        metodo_pago,
        comprobante_pago,
        monto_acordado,
        contratoId
      ]
    );

    res.status(201).json({
      message: "Solicitud y contrato registrados correctamente.",
      contratoId,
    });

  } catch (error) {
    console.error("ERROR EN /soliCon:", error);
    res.status(500).json({ message: "Error al registrar el contrato." });
  }
});

module.exports = router;