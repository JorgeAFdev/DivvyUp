import type { AuthResponse, SessionUser } from '@monorepo/shared';

export const getStorageObject = <T = unknown>(key: string): T | null => {
    const item = localStorage.getItem(key);
    if (item !== null) {
        return JSON.parse(item) as T;
    }
    return null;
};

export const setStorageObject = (data: string): void => {
    localStorage.setItem('user-session', data);
};

export const deleteStorageObject = (key: string): void => {
    localStorage.removeItem(key);
};

export const getUserToken = (): string | null => {
    const session = getStorageObject<AuthResponse>('user-session');
    if (session) {
        return session.token;
    }
    return null;
};

export const getUserSession = (): SessionUser | null => {
    const session = getStorageObject<AuthResponse>('user-session');
    if (session) {
        return session.user;
    }
    return null;
};

export const removeSession = (): void => {
    deleteStorageObject('user-session');
};
