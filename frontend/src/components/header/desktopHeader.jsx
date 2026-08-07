import { Link } from 'react-router-dom';
import styles from './header.module.css';
import HeaderLogo from './headerLogo';
import { ThemeToggle } from './themeToggle';
import UserMenu from '../user/userMenu';
import Notifications from '../notifications/notifications';

const DesktopHeader = () => (
    <header className={styles.header}>
        <HeaderLogo />
        <nav className={styles.nav}>
            <Link to="/groups" className={styles.navItem} >Groups</Link>
            <Link to="/my-expenses" className={styles.navItem} >Expenses</Link>
        </nav>
        <div className={styles.right}>
            <ThemeToggle />
            <Notifications />
            <UserMenu forceUpdate={() => { }} />
        </div>
    </header>
);

export default DesktopHeader;
