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

type SessionStoreValue = { data: unknown };

// Better Auth's reactive session store (what useSession/RequireAuth read).
const sessionStore = authClient.$store.atoms.session as {
    get: () => SessionStoreValue;
    listen: (listener: (value: SessionStoreValue) => void) => () => void;
};

// sign-in/sign-up resolve before that store reflects the new user: they fire a
// signal that refetches the session into it, but the action's promise settles
// first, so a navigate() to a guarded route could read a still-null store and
// bounce to /login. Wait for the store to actually hold a user (not merely to
// settle: on /login it is already settled at data:null), so the component
// navigates against a populated store. A timeout keeps a failed refetch from
// hanging the mutation.
const waitForSession = () =>
    new Promise<void>((resolve) => {
        if (sessionStore.get().data) return resolve();
        let unsubscribe = () => {};
        const timer = setTimeout(() => {
            unsubscribe();
            resolve();
        }, 2000);
        unsubscribe = sessionStore.listen((value) => {
            if (value.data) {
                clearTimeout(timer);
                unsubscribe();
                resolve();
            }
        });
    });

// Signing in or up swaps whose data the cache holds, so both clear it before the
// next screen mounts its queries. The action returns { data, error } instead of
// throwing, so the error is re-thrown for react-query.
const useSessionMutation = <TVariables>(
    action: (variables: TVariables) => Promise<{ error: unknown }>,
) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (variables: TVariables) => {
            const { error } = await action(variables);
            if (error) throw error;
            await waitForSession();
        },
        onSuccess: () => queryClient.clear(),
    });
};

export const useLogin = () =>
    useSessionMutation((credentials: LoginCredentials) => authClient.signIn.email(credentials));

export const useRegister = () =>
    useSessionMutation((credentials: RegisterCredentials) =>
        // Absolute so the verification link lands on the frontend, not the API origin.
        authClient.signUp.email({ ...credentials, callbackURL: `${window.location.origin}/email-verified` }),
    );
