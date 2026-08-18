import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '../utils/authClient';

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterCredentials {
    name: string;
    email: string;
    password: string;
}

// Signing in or up swaps whose data the cache holds, so both clear it before the
// next screen mounts its queries. Better Auth's client updates its own session
// store on success, so there is nothing else to persist here. The action returns
// { data, error } instead of throwing, so the error is re-thrown for react-query.
const useSessionMutation = <TVariables>(
    action: (variables: TVariables) => Promise<{ error: unknown }>,
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (variables: TVariables) => {
            const { error } = await action(variables);
            if (error) throw error;
            // Prime the session store before the component navigates: the action
            // resolves before useSession's atom has the user, so a navigate() to a
            // guarded route would otherwise bounce back to /login.
            await authClient.getSession();
        },
        onSuccess: () => queryClient.clear(),
    });
};

export const useLogin = () =>
    useSessionMutation((credentials: LoginCredentials) => authClient.signIn.email(credentials));

export const useRegister = () =>
    useSessionMutation((credentials: RegisterCredentials) => authClient.signUp.email(credentials));
