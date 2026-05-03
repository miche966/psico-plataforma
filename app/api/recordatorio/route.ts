import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email, nombre, proceso, link, pendientes } = await req.json();

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Falta RESEND_API_KEY en las variables de entorno' }, { status: 500 });
    }

    const { data, error } = await resend.emails.send({
      from: 'Psico-Plataforma <onboarding@resend.dev>',
      to: [email],
      subject: `Recordatorio: Evaluaciones pendientes para ${proceso}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-xl: 12px;">
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
            Este es un correo automático, por favor no respondas a esta dirección.
          </p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
