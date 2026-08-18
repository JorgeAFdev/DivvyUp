export interface AuthedUser {
  id: string;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      // Required: requireSession runs before every authed handler and 401s
      // (without calling next) when the Better Auth session cookie is missing or
      // invalid, so a controller that runs at all has it. TypeScript can't see
      // middleware order, so this is the one place that runtime guarantee is stated.
      user: AuthedUser;
    }
  }
}
