import { AxiosError } from 'axios';

// Pull the { error } message the API puts in a failed response body, falling
// back when the failure is not an axios error or carries no message.
export const apiErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof AxiosError) {
        const data = error.response?.data as { error?: string } | undefined;
        if (data?.error) return data.error;
    }
    return fallback;
};
