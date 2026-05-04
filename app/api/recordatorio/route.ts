import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, nombre, proceso, link, pendientes } = await req.json();

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
      return NextResponse.json({ error: 'Configuración de Gmail incompleta (EMAIL_USER/EMAIL_PASS)' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    const mailOptions = {
      from: `"Gestión Humana - RMSA" <${user}>`,
      replyTo: 'gestion.humana.rmsa@gmail.com',
      to: email,
      subject: `Recordatorio: Evaluaciones pendientes para ${proceso}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #1e293b;">Hola ${nombre},</h2>
          <p style="color: #475569; line-height: 1.6;">
            Te contactamos desde el portal de selección para el cargo de <strong>${proceso}</strong>.
          </p>
          <p style="color: #475569; line-height: 1.6;">
            Vemos que todavía tienes <strong>${pendientes} evaluaciones pendientes</strong> por completar. Para que podamos continuar con tu postulación, es importante que finalices todos los ejercicios.
          </p>
          <div style="margin: 30px 0;">
            <a href="${link}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Continuar con mis evaluaciones
            </a>
          </div>
          <p style="color: #64748b; font-size: 14px;">
            Si el botón no funciona, copia y pega este link en tu navegador:<br>
            <span style="color: #4f46e5;">${link}</span>
          </p>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px;">
            Este es un correo automático enviado a través de Psico-Plataforma.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error enviando email:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
