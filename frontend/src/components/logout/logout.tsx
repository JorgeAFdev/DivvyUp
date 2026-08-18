import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/userContextAuth';

const Logout = () => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();

    if (!user) {
        return null;
    }

    const doLogout = async () => {
        await signOut();
        navigate('/');
        window.location.reload();
    }
    return (
        <button onClick={doLogout} style={{ all: 'unset', cursor: 'pointer' }}>Logout</button>
    )
}

export default Logout;
