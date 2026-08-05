import api from "./axios";

export const login = async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
};

export const register = async ({ name, email, password, profilePicture }) => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('password', password);
    if (profilePicture) {
        formData.append('profilePicture', profilePicture);
    }

    const response = await api.post('/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};
