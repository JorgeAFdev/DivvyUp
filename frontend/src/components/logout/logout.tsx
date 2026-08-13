import { useNavigate } from 'react-router-dom';
import { removeSession, getUserToken } from '../../utils/localStorage';

const Logout = ({ forceUpdate }: { forceUpdate: () => void }) => {
    const navigate = useNavigate();
    const isLogged = !!getUserToken();

    if (!isLogged) {
        return null;
    }

    const doLogout = () => {
        removeSession();
        forceUpdate();
        navigate('/');
        window.location.reload();
    }
    return (
        <button onClick={doLogout} style={{ all: 'unset', cursor: 'pointer' }}>Logout</button>
    )
}

export default Logout;
