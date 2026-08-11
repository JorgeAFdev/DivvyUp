export interface JwtPayload {
  id: string;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      // Required: jwtMiddleware runs before every authed handler and 401s
      // (without calling next) when the token is missing or invalid, so a
      // controller that runs at all has it. TypeScript can't see middleware
      // order, so this is the one place that runtime guarantee is stated.
      jwtPayload: JwtPayload;
    }
  }
}
