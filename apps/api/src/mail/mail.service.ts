import { Injectable, Logger } from '@nestjs/common';
import { demoEmail } from '@plantify/db';
import nodemailer, { type Transporter } from 'nodemailer';
import { InjectDb, type Db } from '../db/db.module.js';

export type OutgoingMail = { to: string; subject: string; html: string; otp?: string };

export type ReceiptData = {
  to: string;
  orderNumber: string;
  invoiceNumber: string;
  items: { name: string; label: string; quantity: number; unitPriceCents: number }[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

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

  sendReceipt(r: ReceiptData) {
    const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
    const rows = r.items
      .map(
        (i) =>
          `<tr><td>${escapeHtml(i.name)} <span style="color:#666">(${escapeHtml(i.label)})</span> × ${i.quantity}</td><td style="text-align:right">${money(i.unitPriceCents * i.quantity)}</td></tr>`,
      )
      .join('');
    return this.send({
      to: r.to,
      subject: `Your Plantify order ${r.orderNumber} is confirmed`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px">
<h2 style="color:#166534">Thanks for your order!</h2>
<p>Order <strong>${r.orderNumber}</strong> · Invoice <strong>${r.invoiceNumber}</strong></p>
<table style="width:100%;border-collapse:collapse">${rows}
<tr><td style="padding-top:8px">Subtotal</td><td style="text-align:right">${money(r.subtotalCents)}</td></tr>
<tr><td>Shipping</td><td style="text-align:right">${money(r.shippingCents)}</td></tr>
<tr><td>Tax</td><td style="text-align:right">${money(r.taxCents)}</td></tr>
<tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${money(r.totalCents)}</strong></td></tr></table>
<p style="color:#666">This is a demo store: nothing was charged and nothing will be shipped.</p></div>`,
    });
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
