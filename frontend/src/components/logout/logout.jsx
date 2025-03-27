import {useNavigate} from 'react-router';
import { removeSession, getUserToken } from '../../utils/localStorage';

const Logout = ({forceUpdate}) => {
    const navigate = useNavigate();
    const isLogged = !!getUserToken();

    if (!isLogged) {
        return undefined;
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