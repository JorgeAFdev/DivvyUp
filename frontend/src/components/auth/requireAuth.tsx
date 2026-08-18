import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/userContextAuth';

// Sends you to login remembering where you were headed, so an invite link
// survives having to register first.
const RequireAuth = ({ children }: { children: ReactNode }) => {
    const { user, isPending } = useAuth();
    const location = useLocation();

    // The session cookie is still being checked; don't bounce to /login yet.
    if (isPending) return null;

    if (!user) {
        const next = encodeURIComponent(`${location.pathname}${location.search}`);
        return <Navigate to={`/login?next=${next}`} replace />;
    }

    return <>{children}</>;
};

export default RequireAuth;
