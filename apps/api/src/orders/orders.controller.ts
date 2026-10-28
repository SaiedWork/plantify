import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { createOrderSchema, payOrderSchema, type Address, type CardInput } from '@plantify/contracts';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../auth/access.js';
import { CART_COOKIE } from '../cart/cart.controller.js';
import { ZodPipe } from '../common/zod-pipe.js';
import { grantInbox } from '../mail/grant-inbox.js';
import { readCookie } from '../mail/demo-inbox-cookie.js';
import { CheckoutService } from './checkout.service.js';
import { OrdersService } from './orders.service.js';

const UUID = z.string().uuid();

@Controller()
export class OrdersController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrdersService,
  ) {}

  @Post('checkout/orders')
  create(@Req() req: AuthedRequest, @Body(new ZodPipe(createOrderSchema)) body: { shippingAddress: Address }) {
    const cart = UUID.safeParse(readCookie(req.headers.cookie, CART_COOKIE));
    return this.checkout.createOrder(req.user!.id, cart.success ? cart.data : null, body.shippingAddress);
  }

  @Post('checkout/orders/:id/pay')
  async pay(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Param('id') id: string,
    @Body(new ZodPipe(payOrderSchema)) body: { card: CardInput },
  ) {
    // The receipt lands in the demo inbox; make sure this browser may read it.
    grantInbox(req as Request, res, req.user!.email);
    return this.checkout.pay(req.user!.id, id, body.card);
  }

  @Post('checkout/payments/:id/confirm')
  async confirm(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response, @Param('id') id: string) {
    grantInbox(req as Request, res, req.user!.email);
    return this.checkout.confirm(req.user!.id, id);
  }

  @Get('orders')
  list(@Req() req: AuthedRequest) {
    return this.orders.listForUser(req.user!.id);
  }

  @Get('orders/:id')
  detail(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orders.detailForUser(req.user!.id, id);
  }
}
