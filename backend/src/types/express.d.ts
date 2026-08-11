import 'express';

export interface JwtPayload {
  id: string;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      jwtPayload: JwtPayload;
    }
  }
}
