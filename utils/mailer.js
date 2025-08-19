const nodemailer = require('nodemailer');
const db = require('../db'); // Asegúrate de que la ruta a tu conexión DB es correcta
const { decryptPassword } = require('./crypto'); // Importamos la función para desencriptar

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
      const password = decryptPassword(settings[`${prefix}_contrasena_encriptada`]);
      return settings[`${prefix}_servidor`] && settings[`${prefix}_usuario`] && password;
    };

    // Lógica de selección y fallback
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
        secure: (parseInt(settings[`${prefix}_puerto`], 10) || 465) === 465, // true for 465, false for other ports
        auth: {
            user: settings[`${prefix}_usuario`],
            pass: decryptPassword(settings[`${prefix}_contrasena_encriptada`]),
        },
        from_name: settings[`${prefix}_nombre_remitente`],
        from_email: settings[`${prefix}_usuario`]
    };
}


// Función principal y pública para enviar el correo
async function sendEmail({ to, subject, htmlContent }) {
  const config = await getMailConfig();

  if (!config) {
    console.error("Envío de correo cancelado: No hay configuración válida.");
    return; // No detenemos el flujo de la app, solo no enviamos el correo.
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
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Correo de bienvenida enviado con éxito:', info.messageId);
  } catch (error) {
    console.error('Error al enviar el correo de bienvenida:', error);
  }
}

module.exports = { sendEmail };