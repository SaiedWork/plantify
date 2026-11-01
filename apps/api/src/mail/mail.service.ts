import { Injectable, Logger } from '@nestjs/common';
import { ORDER_LINK_HOURS } from '@plantify/contracts';
import { demoEmail } from '@plantify/db';
import nodemailer, { type Transporter } from 'nodemailer';
import { InjectDb, type Db } from '../db/db.module.js';
import { orderLinkUrl } from '../orders/guest-access.js';

export type OutgoingMail = { to: string; subject: string; html: string; otp?: string };

export type ReceiptData = {
  to: string;
  orderId: string;
  orderNumber: string;
  invoiceNumber: string;
  items: { name: string; label: string; quantity: number; unitPriceCents: number }[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

/** Full-width call-to-action button for the emails. */
const linkButton = (url: string) =>
  `<a href="${url}" style="display:block;text-align:center;background:#15803d;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:600;margin:0 0 20px">View your order and delivery status</a>`;

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
          `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">${escapeHtml(i.name)} <span style="color:#666">(${escapeHtml(i.label)})</span> × ${i.quantity}</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">${money(i.unitPriceCents * i.quantity)}</td></tr>`,
      )
      .join('');
    const link = orderLinkUrl(r.orderId);
    return this.send({
      to: r.to,
      subject: `Your Plantify order ${r.orderNumber} is confirmed`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5">
<h2 style="color:#166534;margin:0 0 16px">Thanks for your order!</h2>
<p style="margin:0 0 24px">Order <strong>${r.orderNumber}</strong> · Invoice <strong>${r.invoiceNumber}</strong></p>
<table style="width:100%;border-collapse:collapse;margin:0 0 28px">${rows}
<tr><td style="padding:16px 0 6px">Subtotal</td><td style="padding:16px 0 6px;text-align:right">${money(r.subtotalCents)}</td></tr>
<tr><td style="padding:6px 0">Shipping</td><td style="padding:6px 0;text-align:right">${money(r.shippingCents)}</td></tr>
<tr><td style="padding:6px 0">Tax</td><td style="padding:6px 0;text-align:right">${money(r.taxCents)}</td></tr>
<tr><td style="padding:10px 0 0;border-top:1px solid #ddd"><strong>Total</strong></td><td style="padding:10px 0 0;border-top:1px solid #ddd;text-align:right"><strong>${money(r.totalCents)}</strong></td></tr></table>
${linkButton(link.url)}
<p style="color:#666;font-size:13px;margin:0 0 16px">This link works without an account until ${link.expiresAt.toUTCString()} (${ORDER_LINK_HOURS} hours).</p>
<p style="color:#666;font-size:13px;margin:0">This is a demo store: nothing was charged and nothing will be shipped.</p></div>`,
    });
  }

  /** A fresh "view your order" link, sent when the first one expired. */
  sendOrderLink(to: string, orderId: string, orderNumber: string) {
    const link = orderLinkUrl(orderId);
    return this.send({
      to,
      subject: `Your link to order ${orderNumber}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5">
<h2 style="color:#166534;margin:0 0 16px">Plantify</h2>
<p style="margin:0 0 24px">Here is your link to order <strong>${escapeHtml(orderNumber)}</strong>:</p>
${linkButton(link.url)}
<p style="color:#666;font-size:13px;margin:0 0 16px">This link works until ${link.expiresAt.toUTCString()} (${ORDER_LINK_HOURS} hours).</p>
<p style="color:#666;font-size:13px;margin:0">This is a demo store; no real email was sent.</p></div>`,
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
