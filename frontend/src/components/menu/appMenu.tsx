import { Menu, type MenuProps } from '@mui/material';

const AppMenu = ({ children, ...props }: MenuProps) => {
    return (
        <Menu {...props}>
            {children}
        </Menu>
    );
};

export default AppMenu;
