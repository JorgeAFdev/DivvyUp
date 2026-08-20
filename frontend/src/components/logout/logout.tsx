import MenuItem from '@mui/material/MenuItem';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/userContextAuth';

// The menu item is the interactive element, so this renders the MenuItem itself
// rather than a <button> nested inside one (invalid ARIA). signOut updates the
// session store, which re-renders the header to its guest variant, so a plain
// navigate home is enough — no page reload.
const Logout = ({ onClose }: { onClose?: () => void }) => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();

    if (!user) {
        return null;
    }

    const handleLogout = async () => {
        onClose?.();
        await signOut();
        navigate('/');
    };

    return <MenuItem onClick={handleLogout}>Logout</MenuItem>;
};

export default Logout;
