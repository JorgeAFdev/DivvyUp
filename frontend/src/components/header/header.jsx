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
            <header className={`${styles.header} ${darkMode ? styles.headerDark : ''}`}>
                <h1 className={styles.logo}>DivvyUp</h1>
                <nav className={styles.nav}>
                    <Icon handleClick={() => toggleDarkMode()} variant={darkMode ? 'light' : 'dark'} className='theme' />
                    <Link to="/login" className={`${styles.navItem} ${darkMode ? styles.navItemDark : ''}`}>Login</Link>
                    <Link to="/register" className={`${styles.navItem} ${darkMode ? styles.navItemDark : ''}`}>Register</Link>
                </nav>
            </header>
        );
    }

    return (
        <header className={`${styles.header} ${darkMode ? styles.headerDark : ''}`}>
            <h1 className={styles.logo}>DivvyUp</h1>
            <nav className={styles.nav}>
                <Link to="/groups" className={`${styles.navItem} ${darkMode ? styles.navItemDark : ''}`}>Groups</Link>
                <Link to="/my-expenses" className={`${styles.navItem} ${darkMode ? styles.navItemDark : ''}`}>Expenses</Link>
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
