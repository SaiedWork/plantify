import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { createOrderSchema, lookupOrderSchema, payOrderSchema, type Address, type CardInput } from '@plantify/contracts';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { OptionalAuth, Public, type AuthedRequest } from '../auth/access.js';
import { CART_COOKIE } from '../cart/cart.controller.js';
import { RateLimit } from '../common/rate-limit.js';
import { ZodPipe } from '../common/zod-pipe.js';
import { grantInbox } from '../mail/grant-inbox.js';
import { readCookie } from '../mail/demo-inbox-cookie.js';
import { buyerOf } from './buyer.js';
import { CheckoutService } from './checkout.service.js';
import { grantGuestOrder } from './guest-access.js';
import { OrdersService } from './orders.service.js';

const UUID = z.string().uuid();

@Controller()
export class OrdersController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrdersService,
  ) {}

  @OptionalAuth()
  @RateLimit('checkout')
  @Post('checkout/orders')
  async create(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodPipe(createOrderSchema)) body: { shippingAddress: Address; email?: string },
  ) {
    const cart = UUID.safeParse(readCookie(req.headers.cookie, CART_COOKIE));
    const buyer = req.user ? { userId: req.user.id, email: req.user.email } : { userId: null, email: body.email };
    const created = await this.checkout.createOrder(buyer, cart.success ? cart.data : null, body.shippingAddress);
    // A guest has no account to own the order, so this browser remembers it (to pay, then see the confirmation).
    if (!req.user) grantGuestOrder(req as Request, res, created.orderId);
    return created;
  }

  @OptionalAuth()
  @RateLimit('payment')
  @Post('checkout/orders/:id/pay')
  async pay(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Body(new ZodPipe(payOrderSchema)) body: { card: CardInput },
  ) {
    const buyer = buyerOf(req);
    // The receipt lands in the demo inbox; make sure this browser may read it.
    const email = await this.orders.contactEmailFor(buyer, id);
    if (email) grantInbox(req as Request, res, email);
    return this.checkout.pay(buyer, id, body.card);
  }

  @OptionalAuth()
  @RateLimit('payment')
  @Post('checkout/payments/:id/confirm')
  async confirm(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.checkout.confirm(buyerOf(req), id);
  }

  @Get('orders')
  list(@Req() req: AuthedRequest) {
    return this.orders.listForUser(req.user!.id);
  }

  @Post('orders/:id/cancel')
  cancel(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orders.cancelUnpaid(req.user!.id, id);
  }

  /** Public: the order page behind the time-limited link in the confirmation email. */
  @Public()
  @Get('orders/track/:token')
  track(@Param('token') token: string) {
    return this.orders.detailForLink(token);
  }

  /** Public: "email me a new link". Always answers the same, so it cannot be used to find out which orders exist. */
  @Public()
  @RateLimit('lookup')
  @Post('orders/track/request-link')
  async requestLink(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodPipe(lookupOrderSchema)) body: { orderNumber: string; email: string },
  ) {
    if (await this.orders.sendLink(body.orderNumber, body.email)) grantInbox(req, res, body.email);
    return { ok: true };
  }

  @OptionalAuth()
  @Get('orders/:id')
  detail(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orders.detailForBuyer(buyerOf(req), id);
  }
}
