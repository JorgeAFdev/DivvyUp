import type { SessionUser } from '@monorepo/shared';
import { authHeaders } from './authHeaders';
import api from './axios';

export interface UpdateProfileInput {
    name: string;
    email: string;
    profilePicture?: File | null;
}

export interface UpdateProfileResponse {
    message: string;
    user: SessionUser;
}

export const updateUser = async (
    { name, email, profilePicture }: UpdateProfileInput,
    token: string | null,
): Promise<UpdateProfileResponse> => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    if (profilePicture) {
        formData.append('profilePicture', profilePicture);
    }

    const response = await api.patch<UpdateProfileResponse>('/user/update', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            ...authHeaders(token).headers,
        },
    });
    return response.data;
};
