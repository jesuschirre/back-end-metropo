const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

async function generarPDFContrato(nuevoContratoId, connection, req, datosContrato) {
  try {
    const {
      cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin,
      monto_acordado, detalles_anuncio, precio_base, descuento, dias_emision
    } = datosContrato;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const pdfName = `contrato-${nuevoContratoId}-${Date.now()}.pdf`;
    const pdfDir = path.join(__dirname, '..', 'Uploads', 'contratos');
    await fs.mkdir(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, pdfName);
    const stream = fsSync.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Consultas SQL
    const [clienteData] = await connection.query('SELECT * FROM usuarios WHERE id = ?', [cliente_id]);
    const [planData] = await connection.query('SELECT nombre FROM planes WHERE id = ?', [plan_id]);
    const [emisorData] = await connection.query('SELECT nombre, ruc, direccion, telefono FROM configuracion');

    const emisor = emisorData[0] || { nombre: 'Metrópoli Radio', ruc: 'No disponible', direccion: 'No disponible', telefono: 'No disponible' };
    const cliente = clienteData[0] || { nombre: 'No especificado', tipo_documento: 'DOC', numero_documento: 'No especificado', direccion: 'No especificada', correo: 'No especificado' };
    const planNombre = planData[0]?.nombre || 'No especificado';

    // Colores
    const primaryColor = '#1E88E5';
    const secondaryColor = '#4CAF50';
    const grayColor = '#666666';

    // Encabezado
    const logoPath = path.join(__dirname, '..', 'Uploads', 'logo.png');
    if (await fs.access(logoPath).then(() => true).catch(() => false)) {
      doc.image(logoPath, 50, 30, { width: 100 });
    }

    doc.font('Helvetica-Bold').fontSize(16).fillColor(primaryColor).text(emisor.nombre, 200, 30, { align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor(grayColor);
    doc.text(`RUC: ${emisor.ruc}`, 200, 50, { align: 'right' });
    doc.text(emisor.direccion, 200, 65, { align: 'right' });
    doc.text(`Teléfono: ${emisor.telefono}`, 200, 80, { align: 'right' });

    // Título
    doc.moveDown(4);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(primaryColor).text('Contrato de Servicios Publicitarios', { align: 'center' });
    doc.moveDown(1);

    // Datos del contrato
    doc.font('Helvetica').fontSize(12).fillColor('black');
    doc.text(`Contrato ID: ${nuevoContratoId}`, 50);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-PE')}`, 50);
    doc.moveDown(2);

    // Cliente
    doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor).text('Datos del Cliente');
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).lineWidth(1).strokeColor(primaryColor).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11).fillColor(grayColor);
    doc.text(`Nombre / Razón Social: ${cliente.nombre}`);
    doc.text(`${cliente.tipo_documento}: ${cliente.numero_documento}`);
    doc.text(`Dirección: ${cliente.direccion}`);
    doc.text(`Email: ${cliente.correo}`);
    doc.moveDown(2);

    // Tabla de servicio
    doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor).text('Detalles del Servicio Contratado');
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).lineWidth(1).strokeColor(primaryColor).stroke();
    doc.moveDown(0.5);

    function addRow(item, description, value = '', valueColor = 'black') {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(item, 50, doc.y, { width: 120 });
      doc.font('Helvetica').fontSize(11).fillColor(grayColor).text(description, 180, doc.y, { width: 250 });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(valueColor).text(value, 450, doc.y, { align: 'right', width: 100 });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).lineWidth(0.5).strokeColor('#E0E0E0').stroke();
    }

    const diasTexto = Array.isArray(dias_emision)
      ? dias_emision.map(dia => dia.charAt(0).toUpperCase() + dia.slice(1)).join(', ')
      : 'No especificados';

    addRow('Campaña', nombre_campana);
    addRow('Plan', planNombre);
    addRow('Periodo de Vigencia', `Del ${new Date(fecha_inicio).toLocaleDateString('es-PE')} al ${new Date(fecha_fin).toLocaleDateString('es-PE')}`);
    addRow('Días de Emisión', diasTexto);
    if (descuento > 0) {
      addRow('Precio Base', '', `S/ ${parseFloat(precio_base).toFixed(2)}`);
      addRow('Descuento Aplicado', '', `- S/ ${parseFloat(descuento).toFixed(2)}`);
    }
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).lineWidth(1).strokeColor('black').stroke();
    doc.moveDown(0.5);
    addRow('MONTO FINAL', '', `S/ ${parseFloat(monto_acordado).toFixed(2)}`, secondaryColor);

    // Guion
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor).text('Guion y Detalles del Anuncio');
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).lineWidth(1).strokeColor(primaryColor).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(11).fillColor(grayColor).text(detalles_anuncio || 'No se especificaron detalles.', { width: 500, align: 'justify' });

    // Pie de página
    const pageHeight = doc.page.height;
    doc.fontSize(8).fillColor(grayColor).text(
      `© ${new Date().getFullYear()} ${emisor.nombre}. Todos los derechos reservados. Contacto: ${emisor.telefono} | ${emisor.direccion}`,
      50, pageHeight - 50, { align: 'center', width: 500 }
    );

    doc.end();

    const host = req.headers.host || 'localhost:3000';
    const finalPdfUrl = `${req.protocol}://${host}/Uploads/contratos/${pdfName}`;

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve({ pdfUrl: finalPdfUrl, pdfPath, pdfName }));
      stream.on('error', reject);
    });

  } catch (error) {
    console.error('Error al generar PDF:', error);
    throw error;
  }
}

module.exports = { generarPDFContrato };