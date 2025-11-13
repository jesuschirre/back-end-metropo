const express = require ("express")
const router = express.Router();
const db = require('../db');

router.get("/", async (req, res) => {
  try {
    const [tickets] = await db.query(`
      SELECT 
        t.id,
        t.asunto,
        t.categoria,
        t.estado,
        t.prioridad,
        t.fecha_creacion,
        u.nombre AS nombre_cliente
      FROM tickets_soporte t
      INNER JOIN usuarios u ON t.cliente_id = u.id
      ORDER BY t.fecha_creacion DESC
    `);

    res.json(tickets);
  } catch (error) {
    console.error("Error al traer los tickets:", error);
    res.status(500).json({ message: "Error al obtener los tickets" });
  }
});

// Cambiar a "En_Proceso"
router.post("/procesar/:id_ticket", async (req, res) => {
  const { id_ticket } = req.params;
  try {
    const [result] = await db.query(
      "UPDATE tickets_soporte SET estado = 'En_Proceso' WHERE id_ticket = ?",
      [id_ticket]
    );
    res.json({ message: "Ticket actualizado a 'En_Proceso'" });
  } catch (error) {
    res.status(500).json({ message: "Error al procesar ticket" });
  }
});

// Cambiar a "Cerrado"
router.post("/cerrar/:id_ticket", async (req, res) => {
  const { id_ticket } = req.params;
  try {
    const [result] = await db.query(
      "UPDATE tickets_soporte SET estado = 'Cerrado' WHERE id_ticket = ?",
      [id_ticket]
    );
    res.json({ message: "Ticket cerrado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al cerrar ticket" });
  }
});


router.get("/:id_usu", async (req, res) => {
  try {
    const {id_usu} = req.params;
    const [tickets] = await db.query("SELECT * FROM tickets_soporte WHERE cliente_id = ?", [id_usu]);
    res.json(tickets);
  } catch (error) {
    console.error("Error al traer los tickets:", error);
    res.status(500).json({ message: "Error al obtener los tickets" });
  }
});

router.post("/", async (req, res) => {
  const { cliente_id, asunto, categoria } = req.body;

  // Validación de campos obligatorios
  if (!cliente_id || !asunto || !categoria) {
    return res.status(400).json({ error: "Faltan datos" });
  }
  try {
    // Inserción en la base de datos
    await db.query(
      `INSERT INTO tickets_soporte 
        (cliente_id, asunto, categoria, estado, prioridad, fecha_creacion) 
       VALUES (?, ?, ?, 'Abierto', 'Normal', NOW())`,
      [cliente_id, asunto, categoria]
    );

    // Respuesta de éxito
    res.status(201).json({ message: "Ticket creado exitosamente" });

  } catch (error) {
    console.error("Error al crear el ticket:", error);
    res.status(500).json({ error: "Error al crear el ticket" });
  }
});

module.exports = router;