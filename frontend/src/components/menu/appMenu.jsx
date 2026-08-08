import { Menu } from '@mui/material';

const AppMenu = ({ children, ...props }) => {
    return (
        <Menu {...props}>
            {children}
        </Menu>
    );
};

export default AppMenu;
