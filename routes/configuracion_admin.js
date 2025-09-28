const express = require("express");
const router = express.Router();
const db = require("../db");
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, isAdmin);

// Configuración de Multer para la subida del logo
const uploadDir = path.join(__dirname, '..', 'uploads');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname);
        const uniqueSuffix = `logo-${Date.now()}${extension}`;
        cb(null, uniqueSuffix);
    }
});
const upload = multer({ storage });

// GET /api/configuracion_admin - Obtener la configuración de la empresa
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM configuracion WHERE id = 1 LIMIT 1");
        if (rows.length === 0) {
            return res.status(404).json({ error: "No se encontró la configuración de la empresa." });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error("Error al obtener la configuración:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// PUT /api/configuracion_admin - Actualizar la configuración de la empresa
router.put('/', upload.single('logo'), async (req, res) => {
    try {
        const { nombre, ruc, direccion, telefono, email_contacto } = req.body;
        let logoUrl = req.body.logo_url_actual || null; // Mantiene la URL actual si no se sube un nuevo logo

        // Si se subió un nuevo archivo, actualizamos la URL
        if (req.file) {
            logoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const query = `
            UPDATE configuracion SET 
            nombre = ?, ruc = ?, direccion = ?, telefono = ?, email_contacto = ?, logo_url = ? 
            WHERE id = 1
        `;
        
        await db.query(query, [nombre, ruc, direccion, telefono, email_contacto, logoUrl]);
        
        res.json({ message: "Perfil de la empresa actualizado exitosamente." });

    } catch (err) {
        console.error("Error al actualizar la configuración:", err);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

module.exports = router;