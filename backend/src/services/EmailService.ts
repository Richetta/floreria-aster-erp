import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
  }

  async sendInvitationEmail(to: string, businessName: string, inviteLink: string) {
    if (!config.smtpHost || !config.smtpUser) {
      console.warn('Email service not configured. Skipping invitation email.');
      console.log(`Invitation Link for ${to}: ${inviteLink}`);
      return;
    }

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4F7A5A;">¡Hola!</h2>
        <p>Has sido invitado a unirte al equipo de <strong>${businessName}</strong> en <strong>Mi Jardín ERP</strong>.</p>
        <p>Hacé clic en el siguiente botón para aceptar la invitación y crear tu cuenta:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #4F7A5A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Aceptar Invitación</a>
        </div>
        <p style="color: #666; font-size: 0.9em;">Si no podés hacer clic en el botón, copiá y pegá este enlace en tu navegador:</p>
        <p style="color: #666; font-size: 0.8em; word-break: break-all;">${inviteLink}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 0.8em; color: #999; text-align: center;">Este es un correo automático, por favor no lo respondas.</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"Mi Jardín ERP" <${config.emailFrom}>`,
        to,
        subject: `Invitación para unirte a ${businessName}`,
        html,
      });
    } catch (error) {
      console.error('Error sending invitation email:', error);
      throw new Error('No se pudo enviar el correo de invitación');
    }
  }
}

export const emailService = new EmailService();
