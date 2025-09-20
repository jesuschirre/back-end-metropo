// =================================================================
// 1. IMPORTACIONES DE MÓDULOS ESENCIALES
// =================================================================
const express = require('express');
const cors = require('cors');
const path = require("path");

// =================================================================
// 2. CARGA DE VARIABLES DE ENTORNO
// =================================================================
// Esta es la forma correcta y robusta de cargar tu archivo .env.
// Esto asegura que todas las demás variables (DB_HOST, JWT_SECRET, etc.)
// estén disponibles para todas tus rutas.
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// =================================================================
// 3. INICIALIZACIÓN Y CONFIGURACIÓN DE EXPRESS (MIDDLEWARES)
// =================================================================
const app = express();

// Habilitar CORS para permitir la comunicación con el frontend.
app.use(cors());

// Permitir que Express procese cuerpos de solicitud en formato JSON.
app.use(express.json());

// Servir archivos estáticos desde la carpeta 'uploads'.
// Esto es CRUCIAL para que los PDFs (y otras imágenes) sean accesibles desde el navegador.
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =================================================================
// 4. REGISTRO DE RUTAS
// =================================================================
// Aquí se conectan todos tus archivos de rutas a la aplicación principal.
app.use('/api/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/solicitudes', require('./routes/solicitudes'));
app.use('/vendedores', require('./routes/vendedor'));
app.use('/productos', require('./routes/producto'));
app.use('/categorias', require('./routes/categorias'));
app.use('/api/configuracion', require('./routes/configuracionCorreo'));
app.use('/api/planes', require('./routes/planes'));
app.use('/api/admin/usuarios', require('./routes/usuariosadmin'));
app.use('/api/contratos_admin', require('./routes/contratos_admin'));

// --- AÑADE ESTA LÍNEA AQUÍ ---
app.use('/api/consultas_admin', require('./routes/consultas_admin'));
// --------------------------------


// =================================================================
// 5. INICIO DEL SERVIDOR
// =================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));