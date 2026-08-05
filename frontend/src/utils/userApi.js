import { authHeaders } from "./authHeaders";
import api from "./axios";

export const updateUser = async ({ name, email, profilePicture }, token) => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    if (profilePicture) {
        formData.append('profilePicture', profilePicture);
    }

    const response = await api.patch('/user/update', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            ...authHeaders(token).headers,
        },
    });
    return response.data;
};
