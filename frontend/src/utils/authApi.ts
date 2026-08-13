import type { AuthResponse } from '@monorepo/shared';
import api from './axios';

export interface LoginCredentials {
    email: string;
    password: string;
}

export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
};

export interface RegisterInput {
    name: string;
    email: string;
    password: string;
    profilePicture?: File | null;
}

export const register = async ({ name, email, password, profilePicture }: RegisterInput): Promise<AuthResponse> => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('password', password);
    if (profilePicture) {
        formData.append('profilePicture', profilePicture);
    }

    const response = await api.post<AuthResponse>('/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};
