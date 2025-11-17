const {pdfvidenciaC} = require("./pdfestados");
const {pdfporPlanes} = require("./pdfplanes");
const {pdfreportesContratos} = require("./pdfcontratos");
const {generarPDFContrato} = require ("./pdfcontraINDI");
const {pdfdema} = require("./pdfplandema");


module.exports = { generarPDFContrato, pdfreportesContratos, pdfporPlanes, pdfvidenciaC, pdfdema };