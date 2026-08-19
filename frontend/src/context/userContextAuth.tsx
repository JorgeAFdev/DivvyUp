import { authClient } from '../utils/authClient';

// The single seam onto Better Auth's session store. Components read identity from
// here (never from localStorage anymore): `user` is null while logged out, and
// `isPending` is true on the first render while the session cookie is being
// checked, so route guards can wait instead of bouncing to /login prematurely.
export const useAuth = () => {
    const { data, isPending, refetch } = authClient.useSession();

    return {
        user: data?.user ?? null,
        isPending,
        refetch,
        signOut: () => authClient.signOut(),
    };
};

export type AuthUser = NonNullable<ReturnType<typeof useAuth>['user']>;
