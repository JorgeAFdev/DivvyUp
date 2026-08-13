export const authHeaders = (token: string) => {
    return { headers: { Authorization: `Bearer ${token}` } };
};
