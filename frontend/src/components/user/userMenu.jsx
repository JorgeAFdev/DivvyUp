import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Menu, MenuItem, IconButton } from '@mui/material';
import Logout from '../logout/logout';

const UserMenu = ({ forceUpdate }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const isMenuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  return (
    <div>
      <IconButton onClick={handleMenuOpen} style={{ padding: 0 }}>
        <Avatar>A</Avatar>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose} component={Link} to="/profile">
          Profile
        </MenuItem>
        <MenuItem onClick={handleMenuClose} >
          <Logout forceUpdate={forceUpdate} />
        </MenuItem>
      </Menu>
    </div>
  );
};

export default UserMenu;

