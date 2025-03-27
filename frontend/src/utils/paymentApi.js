import { authHeaders } from "./authHeaders";
import api from "./axios";

export const updatePayment = async (paymentId, token) => {
    const response = await api.patch(`/payment/${paymentId}`, {}, authHeaders(token));
    return response.data;
};