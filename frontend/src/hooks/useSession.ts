import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuthResponse } from '@monorepo/shared';
import { useAuth } from '../context/userContextAuth';
import { login as loginRequest, register as registerRequest } from '../utils/authApi';

// Signing in or out swaps whose data the cache holds, so both clear it before
// the next screen mounts its queries.
const useSessionMutation = <TVariables>(mutationFn: (variables: TVariables) => Promise<AuthResponse>) => {
    const { login } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn,
        onSuccess: (session) => {
            queryClient.clear();
            login(session);
        },
    });
};

export const useLogin = () => useSessionMutation(loginRequest);

export const useRegister = () => useSessionMutation(registerRequest);
