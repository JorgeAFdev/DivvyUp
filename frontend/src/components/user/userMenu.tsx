import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { MenuItem, IconButton } from '@mui/material';
import Logout from '../logout/logout';
import { getUserSession } from '../../utils/localStorage';
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
    const user = getUserSession();
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
                <MemberAvatar name={user.name} src={user.profilePicture} />
            </IconButton>
            <AppMenu
                anchorEl={anchorEl}
                open={isMenuOpen}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleMenuClose} component={Link} to="/profile" >
                    Profile
                </MenuItem>
                <MenuItem onClick={handleMenuClose} >
                    <Logout />
                </MenuItem>
            </AppMenu>
        </div>
    );
};

export default UserMenu;
