import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/userContextAuth';
import { updatePayment } from '../utils/paymentApi';
import { queryKeys } from './queryKeys';

// Invalidating on settle covers the 409 too: settling a debt that somebody else
// already settled means the group on screen is stale, which is the one case
// where refetching after a failure is the point.
export const useSettleDebt = (groupId: string) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (paymentId: string) => updatePayment(paymentId, token),
        onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.groupDetails(groupId) }),
    });
};
