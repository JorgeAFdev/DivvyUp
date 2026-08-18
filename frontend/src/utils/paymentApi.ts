import type { HydratedPayment } from '@monorepo/shared';
import api from './axios';

export const updatePayment = async (paymentId: string): Promise<HydratedPayment> => {
    const response = await api.patch<HydratedPayment>(`/payment/${paymentId}`, {});
    return response.data;
};
