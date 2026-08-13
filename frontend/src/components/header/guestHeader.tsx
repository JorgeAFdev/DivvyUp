import { Link } from 'react-router-dom';
import styles from './header.module.css';
import HeaderLogo from './headerLogo';
import { ThemeToggle } from './themeToggle';

const GuestHeader = () => (
    <header className={styles.header}>
        <HeaderLogo />
        <nav className={styles.nav}>
            <Link to="/login" className={styles.navItem} >Login</Link>
            <Link to="/register" className={styles.navItem} >Register</Link>
            <ThemeToggle />
        </nav>
    </header>
);

export default GuestHeader;
