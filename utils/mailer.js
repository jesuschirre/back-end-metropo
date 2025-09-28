const nodemailer = require('nodemailer');
const db = require('../db');
const { decryptPassword } = require('./crypto');

// Función interna para obtener la configuración de correo activa desde la BD
async function getMailConfig() {
  try {
    const [rows] = await db.query("SELECT clave_config, valor_config FROM configuracion_correo");
    if (rows.length === 0) {
      console.error("No se encontró configuración de correo en la base de datos.");
      return null;
    }

    const settings = rows.reduce((acc, row) => {
      acc[row.clave_config] = row.valor_config;
      return acc;
    }, {});

    const activeProvider = settings['proveedor_activo'] || 'gmail';
    let config = null;

    const isConfigValid = (prefix) => {
      try {
        const passwordEncrypted = settings[`${prefix}_contrasena_encriptada`];
        if (!passwordEncrypted) return false;
        const password = decryptPassword(passwordEncrypted);
        return settings[`${prefix}_servidor`] && settings[`${prefix}_usuario`] && password;
      } catch (e) {
        console.error(`Error al desencriptar o validar la configuración para ${prefix}:`, e.message);
        return false;
      }
    };

    if (isConfigValid(activeProvider)) {
      config = buildConfig(settings, activeProvider);
    } else {
      const fallbackProvider = activeProvider === 'gmail' ? 'corporativo' : 'gmail';
      if (isConfigValid(fallbackProvider)) {
        console.warn(`Proveedor activo '${activeProvider}' falló. Usando fallback '${fallbackProvider}'.`);
        config = buildConfig(settings, fallbackProvider);
      }
    }

    if (!config) {
        console.error("Ninguna configuración de correo (ni activa ni fallback) es válida.");
        return null;
    }

    return config;

  } catch (error) {
    console.error("Error al obtener la configuración de correo:", error);
    return null;
  }
}

// Función auxiliar para construir el objeto de configuración
function buildConfig(settings, prefix) {
    return {
        host: settings[`${prefix}_servidor`],
        port: parseInt(settings[`${prefix}_puerto`], 10) || 465,
        secure: (parseInt(settings[`${prefix}_puerto`], 10) || 465) === 465,
        auth: {
            user: settings[`${prefix}_usuario`],
            pass: decryptPassword(settings[`${prefix}_contrasena_encriptada`]),
        },
        from_name: settings[`${prefix}_nombre_remitente`],
        from_email: settings[`${prefix}_usuario`]
    };
}

// --- FUNCIÓN PRINCIPAL Y PÚBLICA (ACTUALIZADA) ---
// Ahora acepta un parámetro opcional 'attachments'
async function sendEmail({ to, subject, htmlContent, attachments = [] }) {
  const config = await getMailConfig();

  if (!config) {
    // Lanzamos un error para que el 'catch' en contratos_admin.js pueda registrarlo
    throw new Error("Envío de correo cancelado: No hay configuración de correo válida.");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  const mailOptions = {
    from: `"${config.from_name}" <${config.from_email}>`,
    to: to,
    subject: subject,
    html: htmlContent,
    attachments: attachments, // <-- Se añade el array de adjuntos
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Correo enviado con éxito:', info.messageId);
  } catch (error) {
    console.error('Error al enviar el correo:', error);
    // Relanzamos el error para que el 'catch' que llama a esta función se entere del fallo.
    throw error;
  }
}

module.exports = { sendEmail };