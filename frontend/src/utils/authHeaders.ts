// token is the session token, which is null when logged out. Callers are gated
// (react-query `enabled`, RequireAuth), so a null here means no auth header
// rather than a "Bearer null" that would reach the server.
export const authHeaders = (token: string | null) => {
    return { headers: token ? { Authorization: `Bearer ${token}` } : {} };
};
