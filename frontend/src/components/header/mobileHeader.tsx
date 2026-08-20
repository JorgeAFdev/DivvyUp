import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Divider, IconButton, MenuItem, useTheme } from '@mui/material';
import styles from './header.module.css';
import HeaderLogo from './headerLogo';
import { ThemeMenuItem } from './themeToggle';
import { MdMenu } from 'react-icons/md';
import AppMenu from '../menu/appMenu';
import Icon from '../icon/icon';
import Notifications from '../notifications/notifications';
import Logout from '../logout/logout';

const MobileHeader = () => {
    const theme = useTheme();
    const { pathname } = useLocation();

    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const isMenuOpen = Boolean(anchorEl);
    const closeMenu = () => setAnchorEl(null);

    useEffect(() => {
        setAnchorEl(null);
    }, [pathname]);

    return (
        <header className={styles.header}>
            <HeaderLogo />
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
                    <Icon icon={MdMenu} size={26} />
                </IconButton>
                <AppMenu
                    id="header-menu"
                    anchorEl={anchorEl}
                    open={isMenuOpen}
                    onClose={closeMenu}
                    MenuListProps={{ 'aria-labelledby': 'header-menu-button' }}
                >
                    <MenuItem component={Link} to="/groups" onClick={closeMenu}>Groups</MenuItem>
                    <MenuItem component={Link} to="/my-expenses" onClick={closeMenu}>Expenses</MenuItem>
                    <Divider />
                    <MenuItem component={Link} to="/profile" onClick={closeMenu}>Profile</MenuItem>
                    <ThemeMenuItem />
                    <Divider />
                    <Logout onClose={closeMenu} />
                </AppMenu>
            </div>
        </header>
    );
};

export default MobileHeader;
