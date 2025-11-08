const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Función de ayuda para dibujar una fila de la tabla de detalles.
 */
function drawTableRow(doc, y, item, description, value, rowHeight = 25, background = null) {
    const itemX = 50;
    const descX = 170;
    const valueX = 430;
    const endX = 545;
    const itemWidth = 110;
    const descWidth = 250;
    const valueWidth = 100;

    // Dibuja el fondo de la fila si se especifica
    if (background) {
        doc.rect(itemX, y, endX - itemX, rowHeight).fill(background);
    }

    // Dibuja las líneas de la celda
    doc.moveTo(itemX, y).lineTo(endX, y).strokeColor('#E0E0E0').stroke(); // Top
    doc.moveTo(itemX, y + rowHeight).lineTo(endX, y + rowHeight).strokeColor('#E0E0E0').stroke(); // Bottom
    doc.moveTo(itemX, y).lineTo(itemX, y + rowHeight).strokeColor('#E0E0E0').stroke(); // Left
    doc.moveTo(descX, y).lineTo(descX, y + rowHeight).strokeColor('#E0E0E0').stroke(); // Middle 1
    doc.moveTo(valueX, y).lineTo(valueX, y + rowHeight).strokeColor('#E0E0E0').stroke(); // Middle 2
    doc.moveTo(endX, y).lineTo(endX, y + rowHeight).strokeColor('#E0E0E0').stroke(); // Right


    // Escribe el texto (ajustado verticalmente)
    const textY = y + (rowHeight / 2) - 5; // Centrado vertical aproximado
    doc.font('Helvetica').fillColor('black').text(item, itemX + 10, textY, { width: itemWidth });
    doc.font('Helvetica').fillColor('black').text(description, descX + 10, textY, { width: descWidth });
    doc.font('Helvetica-Bold').fillColor('black').text(value, valueX, textY, { width: valueWidth, align: 'right' });
}

/**
 * Función de ayuda para dibujar una caja de información (Proveedor / Cliente)
 */
function drawInfoBox(doc, title, data, x, y, width) {
    const boxHeight = 100;
    const titleHeight = 20;
    const primaryColor = '#1E88E5';

    // Fondo del título
    doc.rect(x, y, width, titleHeight).fill(primaryColor);
    // Texto del título
    doc.font('Helvetica-Bold').fontSize(10).fillColor('white').text(title, x + 10, y + 6);
    // Borde de la caja
    doc.rect(x, y, width, boxHeight).strokeColor(primaryColor).stroke();

    // Contenido de la caja
    let contentY = y + titleHeight + 10;
    doc.font('Helvetica').fontSize(9).fillColor('#333333');
    data.forEach(line => {
        doc.text(line, x + 10, contentY, { width: width - 20 });
        contentY += 13; // Siguiente línea
    });
}

async function generarPDFContrato(contratoId, connection, req, datosContrato) {
    const { cliente_id, plan_id, nombre_campana, fecha_inicio, fecha_fin, monto_acordado, detalles_anuncio, precio_base, descuento, dias_emision } = datosContrato;
    
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const pdfName = `contrato-${contratoId}-${Date.now()}.pdf`;
    const pdfDir = path.join(__dirname, '..', 'Uploads', 'contratos');
    await fs.mkdir(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, pdfName);
    const stream = fsSync.createWriteStream(pdfPath);
    doc.pipe(stream);

    // --- Consultas a la BD ---
    const [[cliente]] = await connection.query('SELECT * FROM usuarios WHERE id = ?', [cliente_id]);
    const [[plan]] = await connection.query('SELECT nombre FROM planes WHERE id = ?', [plan_id]);
    const [[emisor]] = await connection.query('SELECT nombre, ruc, direccion, telefono FROM configuracion LIMIT 1');
    
    const emisorInfo = emisor || { nombre: 'Metrópoli Radio', ruc: 'No disponible', direccion: 'No disponible', telefono: 'No disponible' };
    const clienteInfo = cliente || { nombre: 'No especificado', tipo_documento: 'DOC', numero_documento: 'No especificado', direccion: 'No especificada', correo: 'No especificado' };
    const planNombre = plan?.nombre || 'No especificado';
    
    // --- Colores y Fuentes ---
    const primaryColor = '#1E88E5'; // Azul
    const grayColor = '#666666';
    const lightGrayBg = '#F5F5F5'; // Fondo claro para filas

    // --- 1. Cabecera ---
    const logoPath = path.join(__dirname, '..', 'Uploads', 'logo.png');
    if (fsSync.existsSync(logoPath)) { 
        doc.image(logoPath, 50, 40, { width: 120 }); 
    }

    doc.font('Helvetica-Bold').fontSize(18).fillColor(primaryColor);
    doc.text('CONTRATO DE SERVICIOS', 200, 50, { align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor(grayColor);
    doc.text(`Contrato ID: ${contratoId}`, 200, 75, { align: 'right' });
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 200, 90, { align: 'right' });

    doc.moveDown(4);

    // --- 2. Información de las Partes ---
    const boxY = doc.y;
    const boxWidth = 265;
    
    // Caja del Proveedor (Izquierda)
    drawInfoBox(doc, 'PROVEEDOR (LA RADIO)', [
        `Razón Social: ${emisorInfo.nombre}`,
        `RUC: ${emisorInfo.ruc}`,
        `Dirección: ${emisorInfo.direccion}`,
        `Teléfono: ${emisorInfo.telefono}`
    ], 50, boxY, boxWidth);

    // Caja del Cliente (Derecha)
    drawInfoBox(doc, 'CONTRATANTE (EL CLIENTE)', [
        `Razón Social: ${clienteInfo.nombre}`,
        `${clienteInfo.tipo_documento || 'DOC'}: ${clienteInfo.numero_documento || 'N/A'}`,
        `Dirección: ${clienteInfo.direccion || 'No especificada'}`,
        `Email: ${clienteInfo.correo}`
    ], 50 + boxWidth + 10, boxY, boxWidth);

    doc.y = boxY + 100 + 20; // Moverse debajo de las cajas

    // --- 3. Título de la Sección ---
    doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor)
       .text('DETALLES DEL SERVICIO PUBLICITARIO', 50, doc.y);
    doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).lineWidth(1).strokeColor(primaryColor).stroke();
    doc.moveDown(1.5);

    // --- 4. Tabla de Detalles ---
    const tableTop = doc.y;
    const rowHeight = 25;

    // Función para formatear fechas
    const formatDate = (dateStr) => new Date(dateStr + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const diasFormateados = (Array.isArray(dias_emision) ? dias_emision.map(dia => dia.charAt(0).toUpperCase() + dia.slice(1)).join(', ') : 'No especificados');
    
    // Preparar datos para la tabla
    const items = [
        { item: 'Campaña', desc: nombre_campana },
        { item: 'Plan Contratado', desc: planNombre },
        { item: 'Periodo de Vigencia', desc: `Del ${formatDate(fecha_inicio)} al ${formatDate(fecha_fin)}` },
        { item: 'Días de Emisión', desc: diasFormateados }
    ];
    
    if (detalles_anuncio) {
        items.push({ item: 'Guion / Detalles', desc: detalles_anuncio });
    }

    // Dibujar las filas de la tabla
    let currentY = tableTop;
    doc.font('Helvetica-Bold', 10);
    drawTableRow(doc, currentY, 'Item', 'Descripción', 'Valor', rowHeight, lightGrayBg); // Cabecera
    currentY += rowHeight;

    doc.font('Helvetica', 10);
    items.forEach((item, i) => {
        const bg = (i % 2 === 0) ? '#FFFFFF' : lightGrayBg; // Zebra striping
        const descHeight = doc.heightOfString(item.desc || '', { width: 250 });
        const itemHeight = doc.heightOfString(item.item || '', { width: 110 });
        const dynamicRowHeight = Math.max(rowHeight, Math.max(descHeight, itemHeight) + 10);
        
        drawTableRow(doc, currentY, item.item, item.desc || '', item.value || '', dynamicRowHeight, bg);
        currentY += dynamicRowHeight;
    });

    // --- 5. Resumen de Costos ---
    doc.y = currentY + 10;
    
    // Calcular precios
    const fPrecioBase = parseFloat(precio_base || 0);
    const fDescuento = parseFloat(descuento || 0);
    const fMontoAcordado = parseFloat(monto_acordado);

    if (fDescuento > 0) {
        drawTableRow(doc, doc.y, '', 'Precio Base', `S/ ${fPrecioBase.toFixed(2)}`, rowHeight);
        drawTableRow(doc, doc.y + rowHeight, '', 'Descuento Aplicado', `- S/ ${fDescuento.toFixed(2)}`, rowHeight, lightGrayBg);
        doc.y += rowHeight * 2;
    }

    // Fila Total
    drawTableRow(doc, doc.y, '', 'MONTO FINAL (Inc. IGV)', `S/ ${fMontoAcordado.toFixed(2)}`, rowHeight + 5, primaryColor);
    doc.fillColor('white').font('Helvetica-Bold');
    doc.text('MONTO FINAL (Inc. IGV)', 180, doc.y + 7, { width: 250 });
    doc.text(`S/ ${fMontoAcordado.toFixed(2)}`, 430, doc.y + 7, { width: 100, align: 'right' });
    doc.y += rowHeight + 5;
    

    // --- 6. Firmas ---
    const signatureY = doc.page.height - 150;
    doc.strokeColor('black');

    // Línea Izquierda (Proveedor)
    doc.moveTo(70, signatureY).lineTo(270, signatureY).stroke();
    doc.font('Helvetica').fontSize(9).fillColor('black');
    doc.text(emisorInfo.nombre, 70, signatureY + 5, { width: 200, align: 'center' });
    doc.text(`RUC: ${emisorInfo.ruc}`, 70, signatureY + 18, { width: 200, align: 'center' });
    doc.text('EL PROVEEDOR', 70, signatureY + 30, { width: 200, align: 'center' });

    // Línea Derecha (Cliente)
    doc.moveTo(325, signatureY).lineTo(525, signatureY).stroke();
    doc.text(clienteInfo.nombre, 325, signatureY + 5, { width: 200, align: 'center' });
    doc.text(`${clienteInfo.tipo_documento || 'DOC'}: ${clienteInfo.numero_documento || 'N/A'}`, 325, signatureY + 18, { width: 200, align: 'center' });
    doc.text('EL CONTRATANTE', 325, signatureY + 30, { width: 200, align: 'center' });


    // --- 7. Pie de Página ---
    const bottomMargin = doc.page.margins.bottom;
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(grayColor);
    doc.text(`© ${new Date().getFullYear()} ${emisorInfo.nombre}. Todos los derechos reservados.`, 
        doc.page.margins.left, 
        doc.page.height - bottomMargin - 10, 
        { align: 'center', width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
    );

    doc.end();
    
    return new Promise((resolve, reject) => {
        const finalPdfUrl = `${req.protocol}://${req.get('host')}/Uploads/contratos/${pdfName}`;
        stream.on('finish', () => { console.log(`PDF generado: ${pdfPath}`); resolve({ pdfUrl: finalPdfUrl, pdfPath, pdfName }); });
        stream.on('error', (err) => { console.error("Error al escribir el PDF:", err); reject(err); });
    });
}

module.exports = {
    generarPDFContrato
};