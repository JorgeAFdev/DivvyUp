import { Menu, useTheme } from '@mui/material';

const AppMenu = ({ children, ...props }) => {
    const theme = useTheme();

    return (
        <Menu
            {...props}
            sx={{
                '& .MuiPaper-root': {
                    backgroundColor: theme.palette.background.color,
                    color: theme.palette.text.primary,
                },
                '& .MuiMenuItem-root': {
                    transition: 'background-color 0.3s',
                    '&:hover': { backgroundColor: theme.palette.action.hover },
                },
            }}
        >
            {children}
        </Menu>
    );
};

export default AppMenu;
