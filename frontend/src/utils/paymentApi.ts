import type { HydratedPayment } from '@monorepo/shared';
import { authHeaders } from './authHeaders';
import api from './axios';

export const updatePayment = async (paymentId: string, token: string | null): Promise<HydratedPayment> => {
    const response = await api.patch<HydratedPayment>(`/payment/${paymentId}`, {}, authHeaders(token));
    return response.data;
};
