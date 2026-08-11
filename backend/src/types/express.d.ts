import 'express';

export interface JwtPayload {
  id: string;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      // Optional on purpose: only jwtMiddleware sets it, so a handler on a
      // public route (register, login, getInviteName) that reads it without a
      // guard is a compile error. Authed handlers assert it with `!`.
      jwtPayload?: JwtPayload;
    }
  }
}

// The request shape inside a handler that sits behind jwtMiddleware.
export interface AuthedRequest extends Express.Request {
  jwtPayload: JwtPayload;
}
