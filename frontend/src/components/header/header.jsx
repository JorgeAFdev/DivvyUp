import { Link } from 'react-router-dom';
import { useAuth } from '../../context/userContextAuth';
import styles from './header.module.css';
import { useDarkMode } from '../../context/darkModeContext';
import Icon from '../icon/icon';
import UserMenu from '../user/userMenu';
import Notifications from '../notifications/notifications';

const Header = () => {
    const { darkMode, toggleDarkMode } = useDarkMode();
    const { token } = useAuth();

    if (!token) {
        return (
            <header className={styles.header}>
                <Link to="/">
                    <img src="/assets/logo.png" alt="Logo DivvyUp" className={styles.logo} />
                </Link>
                <nav className={styles.nav}>
                    <Link to="/login" className={styles.navItem} >Login</Link>
                    <Link to="/register" className={styles.navItem} >Register</Link>
                    <Icon handleClick={() => toggleDarkMode()} variant={darkMode ? 'light' : 'dark'} className='theme' />
                </nav>
            </header>
        );
    }

    return (
        <header className={styles.header}>
            <Link to="/">
                <img src="/assets/logo.png" alt="Logo DivvyUp" className={styles.logo} />
            </Link>
            <nav className={styles.nav}>
                <Link to="/groups" className={styles.navItem} >Groups</Link>
                <Link to="/my-expenses" className={styles.navItem} >Expenses</Link>
            </nav>
            <div className={styles.right}>
                <Icon handleClick={() => toggleDarkMode()} variant={darkMode ? 'light' : 'dark'} className='theme' />
                <Notifications />
                <UserMenu forceUpdate={() => { }} />
            </div>
        </header>
    );
};

export default Header;
