import { AxiosError } from 'axios';

// Pull the human message out of a failed request. Two shapes reach here: the
// REST endpoints answer axios errors with a { error } body; Better Auth's client
// (login/register) throws a better-fetch error carrying a top-level `message`.
export const apiErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof AxiosError) {
        // Only the { error } body carries a human message; a network error or a
        // 502 has none, and axios's own message ("Network Error") is not for the
        // user, so fall back rather than through to the message branch below.
        const data = error.response?.data as { error?: unknown } | undefined;
        return typeof data?.error === 'string' ? data.error : fallback;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message) return message;
    }
    return fallback;
};
