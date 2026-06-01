// OAuth controller: thin HTTP layer that delegates to OAuthService.

import { Request, Response, NextFunction } from 'express';
import { oauthService } from './service.js';

export class OAuthController {
  /** GET /api/v1/auth/oauth/:provider — redirect to IdP authorize URL. */
  async redirect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const provider = req.params.provider;
      const redirectUri = this.resolveCallbackUrl(req, provider);
      const result = oauthService.buildAuthorizeUrl(provider, redirectUri);
      res.redirect(result.url);
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/v1/auth/oauth/:provider/callback — exchange code → redirect to frontend. */
  async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const provider = req.params.provider;
      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;
      const redirectUri = this.resolveCallbackUrl(req, provider);
      const result = await oauthService.handleCallback(provider, {
        code,
        state,
        redirectUri,
      });
      // Redirect to the frontend callback page with the token and userId.
      const frontendUrl = this.resolveFrontendBaseUrl(req);
      const params = new URLSearchParams({
        token: result.authResponse.accessToken,
        userId: result.authResponse.user.id,
      });
      res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    } catch (error) {
      // Redirect to login with error message on failure.
      const frontendUrl = this.resolveFrontendBaseUrl(req);
      const msg = error instanceof Error ? error.message : 'OAuth failed';
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(msg)}`);
    }
  }

  /** Build the callback URL from the incoming request host. */
  private resolveCallbackUrl(req: Request, provider: string): string {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    return `${proto}://${host}/api/v1/auth/oauth/${provider}/callback`;
  }

  /** Determine the frontend base URL for post-OAuth redirects. */
  private resolveFrontendBaseUrl(req: Request): string {
    const origin = req.query.redirect_origin as string | undefined;
    if (origin && /^https?:\/\//.test(origin)) {
      return origin;
    }
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    return `${proto}://${host}`;
  }
}

export const oauthController = new OAuthController();
