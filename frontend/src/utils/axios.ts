import axios from 'axios';

// withCredentials sends the Better Auth session cookie on every request; auth is
// no longer a per-call Authorization header, so there is no authHeaders anymore.
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
