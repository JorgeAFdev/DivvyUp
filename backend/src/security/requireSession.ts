import type { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import type { Auth } from './auth.js';

// Replaces the old jwtMiddleware: the identity now comes from the Better Auth
// session cookie, not an Authorization: Bearer JWT. On a valid session it puts
// { id, name, email } on req.user (the shape the controllers read); otherwise 401.
export const requireSession = async (req: Request, res: Response, next: NextFunction) => {
    const auth = req.app.get('auth') as Auth;

    try {
        const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        if (!result) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id, name, email } = result.user;
        req.user = { id, name, email };
        next();
    } catch (error) {
        // A throw here (transient DB error, missing auth on the app) must reach
        // the error handler, not escape as an unhandled rejection.
        next(error);
    }
};
