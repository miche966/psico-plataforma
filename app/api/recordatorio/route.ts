import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import { generarTokenEvaluacion } from '@/lib/server/evaluacionToken';

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: Request) {
  try {
    let { email, nombre, proceso, link, pendientes, candidato_id, proceso_id } = await req.json();

    if (!email || !nombre || !proceso || !link) {
      return NextResponse.json(
        { error: 'ParÃ¡metros incompletos (email, nombre, proceso, link son requeridos)' },
        { status: 400 }
      );
    }

    // SanitizaciÃ³n de seguridad: Reemplazar localhost por la URL pÃºblica de producciÃ³n para postulantes
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL && !process.env.NEXT_PUBLIC_BASE_URL.includes('localhost')
      ? process.env.NEXT_PUBLIC_BASE_URL
      : 'https://psico-plataforma.vercel.app';

    if (link && link.includes('localhost:3000')) {
      link = link.replace('http://localhost:3000', baseUrl);
    }
    if (candidato_id && proceso_id) {
      if (!process.env.EVALUACION_LINK_SECRET) {
        return NextResponse.json({ error: 'EVALUACION_LINK_SECRET no está configurado en el servidor.' }, { status: 503 });
      }
      const token = generarTokenEvaluacion(String(candidato_id), String(proceso_id));
      const linkFirmado = new URL(link);
      linkFirmado.searchParams.set('token', token);
      link = linkFirmado.toString();
    }

    // Control de frecuencia: si la tabla a?n no existe, se mantiene el env?o manual anterior.
    let controlRecordatorioDisponible = true;
    try {
      const controlUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/rest/v1/recordatorios_evaluacion?select=enviado_en&email=eq.' + encodeURIComponent(email) + '&order=enviado_en.desc&limit=1';
      const ultimo = await fetch(controlUrl, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' } });
      if (ultimo.ok) {
        const filas = await ultimo.json();
        const fechaUltimo = filas?.[0]?.enviado_en ? new Date(filas[0].enviado_en).getTime() : 0;
        if (fechaUltimo && Date.now() - fechaUltimo < 24 * 60 * 60 * 1000) {
          return NextResponse.json({ error: 'Ya se envi? un recordatorio a este candidato durante las ?ltimas 24 horas.' }, { status: 429 });
        }
      } else if (ultimo.status === 404 || ultimo.status === 401 || ultimo.status === 403) {
        controlRecordatorioDisponible = false;
      }
    } catch (controlError) {
      controlRecordatorioDisponible = false;
      console.warn('Control de frecuencia no disponible; se conserva el env?o manual:', controlError);
    }

    const host = process.env.EMAIL_HOST || 'rmclhyp1mail1.republicamicrofinanzas.com.uy';
    const port = Number(process.env.EMAIL_PORT || 587);
    const user = process.env.EMAIL_USER || 'seleccion@republicamicrofinanzas.com.uy';
    const pass = process.env.EMAIL_PASS;

    if (!host || !user || !pass) {
      return NextResponse.json(
        { error: 'ConfiguraciÃ³n SMTP incompleta. Verifique EMAIL_HOST, EMAIL_USER y EMAIL_PASS en las variables del servidor.' },
        { status: 500 }
      );
    }

    const rejectUnauthorized = process.env.SMTP_REJECT_UNAUTHORIZED !== 'false';

    // ConfiguraciÃ³n de transporte SMTP para Zimbra con STARTTLS en puerto 587
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      requireTLS: true,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized,
        minVersion: 'TLSv1.2',
      },
    });

    const nombreHtml = escapeHtml(nombre);
    const procesoHtml = escapeHtml(proceso);
    const pendientesHtml = escapeHtml(String(pendientes ?? 1));
    const linkHtml = escapeHtml(link);

    const mailOptions = {
      from: `"SelecciÃ³n - RepÃºblica Microfinanzas" <${user}>`,
      replyTo: user,
      to: email,
      bcc: user,
      subject: `Recordatorio: Evaluaciones pendientes para ${proceso}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #1e293b;">Hola ${nombreHtml},</h2>
          <p style="color: #475569; line-height: 1.6;">
            Te contactamos desde el portal de selecciÃ³n para el cargo de <strong>${procesoHtml}</strong>.
          </p>
          <p style="color: #475569; line-height: 1.6;">
            Vemos que todavÃ­a tienes <strong>${pendientesHtml} evaluaciones pendientes</strong> por completar. Para que podamos continuar con tu postulaciÃ³n, es importante que finalices todos los ejercicios.
          </p>
          <div style="margin: 30px 0;">
            <a href="${linkHtml}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Continuar con mis evaluaciones
            </a>
          </div>
          <p style="color: #64748b; font-size: 14px;">
            Si el botÃ³n no funciona, copia y pega este link en tu navegador:<br>
            <span style="color: #4f46e5;">${linkHtml}</span>
          </p>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px;">
            Este es un correo automÃ¡tico enviado a travÃ©s de Psico-Plataforma.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    if (controlRecordatorioDisponible) {
      try {
        const logUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/rest/v1/recordatorios_evaluacion';
        await fetch(logUrl, {
          method: 'POST',
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ candidato_id: candidato_id || null, proceso_id: proceso_id || null, email, estado: 'enviado', pendientes: String(pendientes ?? '') })
        });
      } catch (logError) {
        console.warn('No se pudo registrar el recordatorio, pero el correo fue enviado:', logError);
      }
    }

    return NextResponse.json({ success: true, sender: user });
  } catch (err: any) {
    console.error('Error enviando email vÃ­a Zimbra SMTP:', err.message || err);
    return NextResponse.json({ error: err.message || 'Error interno al enviar el correo' }, { status: 500 });
  }
}

