const express = require('express');
const cors = require('cors');
const app = express();
const path = require("path");

// Habilitar CORS para cualquier origen
app.use(cors());

// Si quieres permitir solo tu frontend (más seguro):
// app.use(cors({ origin: 'http://localhost:5173' }));

app.use(express.json()); // para recibir JSON
// Hacer pública la carpeta uploads (en la raíz del backend)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(express.json());



// Resto de tus rutas
app.use('/users', require('./routes/users'));
app.use('/solicitudes', require('./routes/solicitudes'));
app.use('/vendedores', require('./routes/vendedor'));
app.use('/productos', require('./routes/producto'));
app.use('/categorias', require('./routes/categorias'));


app.listen(3000, () => console.log('Servidor corriendo en http://localhost:3000'));