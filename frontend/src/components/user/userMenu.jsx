import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, MenuItem, IconButton, useTheme } from '@mui/material';
import Logout from '../logout/logout';
import { getUserSession } from '../../utils/localStorage';
import MemberAvatar from '../avatar/memberAvatar';

const UserMenu = ({ forceUpdate }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const isMenuOpen = Boolean(anchorEl);

  const theme = useTheme();
  const textColor = theme.palette.text.primary;
  const colorBg = theme.palette.background.color;
  const hoverBg = theme.palette.action.hover;

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const user = getUserSession();
  return (
    <div>
      <IconButton onClick={handleMenuOpen} style={{ padding: 0 }}>
        <MemberAvatar name={user.name} src={user.profilePicture} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        sx={{
          '& .MuiPaper-root': { backgroundColor: colorBg, color: textColor }, '& .MuiMenuItem-root': {
            transition: 'background-color 0.3s', '&:hover': { backgroundColor: hoverBg }
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