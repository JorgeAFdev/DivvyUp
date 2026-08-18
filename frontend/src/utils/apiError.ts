import { AxiosError } from 'axios';

// Pull the human message out of a failed request. Two shapes reach here: the
// REST endpoints answer axios errors with a { error } body; Better Auth's client
// (login/register) throws a better-fetch error carrying a top-level `message`.
export const apiErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof AxiosError) {
        const data = error.response?.data as { error?: string } | undefined;
        if (data?.error) return data.error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message) return message;
    }
    return fallback;
};
