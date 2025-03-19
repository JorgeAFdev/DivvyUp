import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@mui/material';
import Logout from '../logout/logout';

const UserMenu = ({ forceUpdate }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="user-menu-container">
      <div className="avatar" onClick={toggleMenu}>
        <Avatar>A</Avatar> {/* Esto puede cambiar dependiendo del nombre o imagen del usuario */}
      </div>

      {isMenuOpen && (
        <div className="menu">
          <Link to="/profile" className="menu-item">Profile</Link>
          {/* Llamamos a Logout como un componente aquí */}
          <Logout forceUpdate={forceUpdate} />
        </div>
      )}
    </div>
  );
};

export default UserMenu;
