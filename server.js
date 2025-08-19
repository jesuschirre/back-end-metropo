// =================================================================
// 1. IMPORTACIONES DE MÓDULOS ESENCIALES
// =================================================================
const express = require('express');
const cors = require('cors');
const path = require("path"); // Necesario para construir rutas de archivos

// =================================================================
// 2. CARGA DE VARIABLES DE ENTORNO (LA SOLUCIÓN)
// =================================================================
// Esta es la corrección clave. Cargamos el archivo .env explícitamente.
// Le decimos a dotenv: "Busca y carga el archivo llamado '.env' que está
// en el mismo directorio donde se encuentra este script (server.js)".
// Esto se hace ANTES de importar cualquier ruta que dependa de estas variables.
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// =================================================================
// 3. INICIALIZACIÓN Y CONFIGURACIÓN DE EXPRESS (MIDDLEWARES)
// =================================================================
const app = express();

// Habilitar CORS para permitir la comunicación con el frontend.
app.use(cors());

// Permitir que Express procese cuerpos de solicitud en formato JSON.
// (Nota: Lo tenías dos veces, con una vez es suficiente).
app.use(express.json());

// Servir archivos estáticos desde la carpeta 'uploads'.
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =================================================================
// 4. REGISTRO DE RUTAS
// =================================================================
// Ahora que las variables de entorno están cargadas, podemos importar
// y usar nuestras rutas de forma segura.
app.use('/users', require('./routes/users'));
app.use('/solicitudes', require('./routes/solicitudes'));
app.use('/vendedores', require('./routes/vendedor'));
app.use('/productos', require('./routes/producto'));
app.use('/categorias', require('./routes/categorias'));
app.use('/api/configuracion', require('./routes/configuracionCorreo')); // <-- Tu nueva ruta
app.use('/api/planes', require('./routes/planes'));
// =================================================================
// 5. INICIO DEL SERVIDOR
// =================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));