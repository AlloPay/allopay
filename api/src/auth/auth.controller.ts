import { Controller, Get, Request as RequestDec } from '@nestjs/common';
import { Request } from 'express';
import { generateNonce } from 'siwe';

import { Public } from '~/decorators/public.decorator';

@Controller('auth')
@Public()
export class AuthController {
  @Get('nonce')
  nonce(@RequestDec() req: Request): string {
    if (!req.session.nonce) req.session.nonce = generateNonce();
    return req.session.nonce;
  }
}
