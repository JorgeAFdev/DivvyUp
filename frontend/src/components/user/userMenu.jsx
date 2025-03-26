import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Menu, MenuItem, IconButton } from '@mui/material';
import Logout from '../logout/logout';
import { getUserSession } from '../../utils/localStorage';
import { useDarkMode } from '../../context/darkModeContext';

const UserMenu = ({ forceUpdate }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const isMenuOpen = Boolean(anchorEl);

  const { darkMode } = useDarkMode();

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const user = getUserSession();
  const profilePicture = user.profilePicture || 'https://via.placeholder.com/150';
  return (
    <div>
      <IconButton onClick={handleMenuOpen} style={{ padding: 0 }}>
        <Avatar src={profilePicture} alt="profile Picture" sx={{ backgroundColor: 'white' }} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        sx={{
          '& .MuiPaper-root': { backgroundColor: darkMode ? '#333333' : '#FAFAFA', color: darkMode ? '#FAFAFA' : '#000000' }, '& .MuiMenuItem-root': {
            transition: 'background-color 0.3s', '&:hover': { backgroundColor: darkMode ? '#09090b' : '', }
          }
        }}
      >
        <MenuItem onClick={handleMenuClose} component={Link} to="/profile" >
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