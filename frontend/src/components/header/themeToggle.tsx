import { IconButton, MenuItem, useTheme } from '@mui/material';
import { CiLight } from 'react-icons/ci';
import { MdOutlineDarkMode } from 'react-icons/md';
import { useDarkMode } from '../../context/darkModeContext';
import Icon from '../icon/icon';

const label = (darkMode: boolean) => (darkMode ? 'Light mode' : 'Dark mode');
const themeIcon = (darkMode: boolean) => (darkMode ? CiLight : MdOutlineDarkMode);

export const ThemeToggle = () => {
    const { darkMode, toggleDarkMode } = useDarkMode();
    const theme = useTheme();

    return (
        <IconButton
            aria-label={label(darkMode)}
            onClick={toggleDarkMode}
            sx={{ padding: 0, color: theme.palette.text.primary }}
        >
            <Icon icon={themeIcon(darkMode)} size={25} />
        </IconButton>
    );
};

export const ThemeMenuItem = () => {
    const { darkMode, toggleDarkMode } = useDarkMode();

    return (
        <MenuItem onClick={toggleDarkMode}>
            {label(darkMode)}
        </MenuItem>
    );
};
