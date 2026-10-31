import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { addCartItemSchema, updateCartItemSchema, type AddCartItemInput } from '@plantify/contracts';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Public } from '../auth/access.js';
import { RateLimit } from '../common/rate-limit.js';
import { ZodPipe } from '../common/zod-pipe.js';
import { readCookie } from '../mail/demo-inbox-cookie.js';
import { CartService } from './cart.service.js';

export const CART_COOKIE = 'plantify_cart';
const UUID = z.string().uuid();

/** Guest-friendly cart: identified by an unguessable httpOnly cookie, claimed by a user at checkout. */
@Public()
@RateLimit('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  private async existingCartId(req: Request) {
    const raw = readCookie(req.headers.cookie, CART_COOKIE);
    const parsed = UUID.safeParse(raw);
    return parsed.success && (await this.cart.cartExists(parsed.data)) ? parsed.data : null;
  }

  private async ensureCartId(req: Request, res: Response) {
    const existing = await this.existingCartId(req);
    if (existing) return existing;
    const id = await this.cart.create();
    res.cookie(CART_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
    });
    return id;
  }

  @Get()
  async get(@Req() req: Request) {
    return this.cart.view(await this.existingCartId(req));
  }

  @Post('items')
  async add(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body(new ZodPipe(addCartItemSchema)) body: AddCartItemInput,
  ) {
    const cartId = await this.ensureCartId(req, res);
    await this.cart.setQuantity(cartId, body.variantId, body.quantity, 'add');
    return this.cart.view(cartId);
  }

  @Patch('items/:variantId')
  async update(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('variantId') variantId: string,
    @Body(new ZodPipe(updateCartItemSchema)) body: { quantity: number },
  ) {
    const cartId = await this.ensureCartId(req, res);
    await this.cart.setQuantity(cartId, variantId, body.quantity, 'set');
    return this.cart.view(cartId);
  }

  @Delete('items/:variantId')
  async remove(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Param('variantId') variantId: string) {
    const cartId = await this.ensureCartId(req, res);
    await this.cart.setQuantity(cartId, variantId, 0, 'set');
    return this.cart.view(cartId);
  }
}
