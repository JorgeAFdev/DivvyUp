import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/userContextAuth';

// Sends you to login remembering where you were headed, so an invite link
// survives having to register first.
const RequireAuth = () => {
    const { user, isPending } = useAuth();
    const location = useLocation();

    // The session cookie is still being checked; don't bounce to /login yet.
    if (isPending) return null;

    if (!user) {
        const next = encodeURIComponent(`${location.pathname}${location.search}`);
        return <Navigate to={`/login?next=${next}`} replace />;
    }

    return <Outlet />;
};

export default RequireAuth;
