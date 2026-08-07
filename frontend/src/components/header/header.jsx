import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Divider, IconButton, Menu, MenuItem, useMediaQuery, useTheme } from '@mui/material';
import { useAuth } from '../../context/userContextAuth';
import { useDarkMode } from '../../context/darkModeContext';
import styles from './header.module.css';
import Icon from '../icon/icon';
import UserMenu from '../user/userMenu';
import Notifications from '../notifications/notifications';
import Logout from '../logout/logout';

const MOBILE_QUERY = '(max-width: 767px)';

const Header = () => {
    const { darkMode, toggleDarkMode } = useDarkMode();
    const { token } = useAuth();
    const theme = useTheme();
    const isMobile = useMediaQuery(MOBILE_QUERY);
    const { pathname } = useLocation();

    const [anchorEl, setAnchorEl] = useState(null);
    const isMenuOpen = Boolean(anchorEl);
    const closeMenu = () => setAnchorEl(null);

    useEffect(() => {
        setAnchorEl(null);
    }, [pathname, isMobile]);

    const logo = (
        <Link to="/">
            <img src="/assets/logo.png" alt="Logo DivvyUp" className={styles.logo} />
        </Link>
    );

    const themeToggle = (
        <Icon handleClick={() => toggleDarkMode()} variant={darkMode ? 'light' : 'dark'} className='theme' />
    );

    if (!token) {
        return (
            <header className={styles.header}>
                {logo}
                <nav className={styles.nav}>
                    <Link to="/login" className={styles.navItem} >Login</Link>
                    <Link to="/register" className={styles.navItem} >Register</Link>
                    {themeToggle}
                </nav>
            </header>
        );
    }

    if (isMobile) {
        return (
            <header className={styles.header}>
                {logo}
                <div className={styles.right}>
                    <Notifications />
                    <IconButton
                        id="header-menu-button"
                        aria-label="Open menu"
                        aria-haspopup="true"
                        aria-controls={isMenuOpen ? 'header-menu' : undefined}
                        aria-expanded={isMenuOpen}
                        onClick={(event) => setAnchorEl(event.currentTarget)}
                        sx={{ color: theme.palette.text.primary }}
                    >
                        <Icon variant="menu" className='menu' />
                    </IconButton>
                    <Menu
                        id="header-menu"
                        anchorEl={anchorEl}
                        open={isMenuOpen}
                        onClose={closeMenu}
                        MenuListProps={{ 'aria-labelledby': 'header-menu-button' }}
                        sx={{
                            '& .MuiPaper-root': {
                                backgroundColor: theme.palette.background.color,
                                color: theme.palette.text.primary,
                            },
                            '& .MuiMenuItem-root': {
                                gap: '10px',
                                transition: 'background-color 0.3s',
                                '&:hover': { backgroundColor: theme.palette.action.hover },
                            },
                        }}
                    >
                        <MenuItem component={Link} to="/groups" onClick={closeMenu}>Groups</MenuItem>
                        <MenuItem component={Link} to="/my-expenses" onClick={closeMenu}>Expenses</MenuItem>
                        <Divider />
                        <MenuItem component={Link} to="/profile" onClick={closeMenu}>Profile</MenuItem>
                        <MenuItem onClick={closeMenu}><Logout forceUpdate={() => { }} /></MenuItem>
                        <Divider />
                        <MenuItem onClick={() => { toggleDarkMode(); closeMenu(); }}>
                            <Icon variant={darkMode ? 'light' : 'dark'} className='theme' />
                            {darkMode ? 'Light mode' : 'Dark mode'}
                        </MenuItem>
                    </Menu>
                </div>
            </header>
        );
    }

    return (
        <header className={styles.header}>
            {logo}
            <nav className={styles.nav}>
                <Link to="/groups" className={styles.navItem} >Groups</Link>
                <Link to="/my-expenses" className={styles.navItem} >Expenses</Link>
            </nav>
            <div className={styles.right}>
                {themeToggle}
                <Notifications />
                <UserMenu forceUpdate={() => { }} />
            </div>
        </header>
    );
};

export default Header;
