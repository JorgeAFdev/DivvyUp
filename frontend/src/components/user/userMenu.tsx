import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { MenuItem, IconButton } from '@mui/material';
import Logout from '../logout/logout';
import { useAuth } from '../../context/userContextAuth';
import MemberAvatar from '../avatar/memberAvatar';
import AppMenu from '../menu/appMenu';

const UserMenu = () => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const isMenuOpen = Boolean(anchorEl);

    const handleMenuOpen = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };
    const { user } = useAuth();
    if (!user) return null;

    return (
        <div>
            <IconButton
                onClick={handleMenuOpen}
                style={{ padding: 0 }}
                aria-label="Account menu"
                aria-haspopup="true"
                aria-expanded={isMenuOpen}
            >
                <MemberAvatar name={user.name} src={user.image ?? undefined} />
            </IconButton>
            <AppMenu
                anchorEl={anchorEl}
                open={isMenuOpen}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleMenuClose} component={Link} to="/profile" >
                    Profile
                </MenuItem>
                <Logout onClose={handleMenuClose} />
            </AppMenu>
        </div>
    );
};

export default UserMenu;
