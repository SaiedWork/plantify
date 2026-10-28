import { Injectable, Logger } from '@nestjs/common';
import { demoEmail } from '@plantify/db';
import nodemailer, { type Transporter } from 'nodemailer';
import { InjectDb, type Db } from '../db/db.module.js';

export type OutgoingMail = { to: string; subject: string; html: string; otp?: string };

/**
 * Every email is stored in `demo_email` (what the in-app "demo inbox" shows).
 * When SMTP_URL is set (local dev) it is additionally sent through SMTP, i.e. Mailpit.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null = process.env.SMTP_URL
    ? nodemailer.createTransport(process.env.SMTP_URL)
    : null;

  constructor(@InjectDb() private readonly db: Db) {}

  async send(mail: OutgoingMail) {
    await this.db.insert(demoEmail).values(mail);
    if (!this.transporter) return;
    try {
      await this.transporter.sendMail({ from: 'Plantify <hello@plantify.test>', ...mail });
    } catch (err) {
      // The demo inbox copy is the source of truth, so SMTP trouble must not break sign-up.
      this.logger.warn(`SMTP delivery failed: ${(err as Error).message}`);
    }
  }

  sendOtp(email: string, otp: string, type: string) {
    const purpose =
      type === 'sign-in' ? 'sign in to' : type === 'forget-password' ? 'reset your password for' : 'verify your email for';
    return this.send({
      to: email,
      otp,
      subject: `${otp} is your Plantify verification code`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:420px">
<h2 style="color:#166534">Plantify</h2>
<p>Use this code to ${purpose} your account:</p>
<p style="font-size:32px;letter-spacing:8px;font-weight:700">${otp}</p>
<p style="color:#666">It expires in 10 minutes. This is a demo store; no real email was sent.</p></div>`,
    });
  }
}
