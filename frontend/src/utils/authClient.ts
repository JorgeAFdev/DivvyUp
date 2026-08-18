import { createAuthClient } from 'better-auth/react';

// VITE_API_URL already ends in /api (the backend router mount), so /auth is
// appended here to hit /api/auth/* — where index.ts mounts the Better Auth
// handler. Note: basePath is NOT used, because Better Auth's client ignores it
// once baseURL already carries a path (withPath returns the URL as-is), which
// would leave calls at /api/* instead of /api/auth/*.
// credentials:'include' sends the session cookie cross-subdomain (front and back
// share the registrable domain, so the cookie is SameSite=Lax).
export const authClient = createAuthClient({
    baseURL: `${import.meta.env.VITE_API_URL}/auth`,
    fetchOptions: { credentials: 'include' },
});
