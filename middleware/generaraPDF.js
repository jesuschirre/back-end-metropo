const {pdfvidenciaC} = require("./pdfestados");
const {pdfporPlanes} = require("./pdfplanes");
const {pdfreportesContratos} = require("./pdfcontratos");
const {generarPDFContrato} = require ("./pdfcontraINDI");


module.exports = { generarPDFContrato, pdfreportesContratos, pdfporPlanes, pdfvidenciaC };