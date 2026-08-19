import { useMutation, useQuery } from '@tanstack/react-query';
import { updateUser, type UpdateProfileInput } from '../utils/userApi';
import { authClient } from '../utils/authClient';
import { useAuth } from '../context/userContextAuth';
import { queryKeys } from './queryKeys';

export const useUpdateProfile = () =>
    useMutation({
        mutationFn: (data: UpdateProfileInput) => updateUser(data),
    });

// A Google-only user's email is their provider identity, so the profile form
// keeps it read-only; the backend rejects the change either way.
export const useHasPassword = () => {
    const { user } = useAuth();

    return useQuery({
        queryKey: queryKeys.accounts(),
        queryFn: async () => {
            const { data, error } = await authClient.listAccounts();
            if (error) throw error;
            return (data ?? []).some((account) => account.providerId === 'credential');
        },
        enabled: Boolean(user),
    });
};
