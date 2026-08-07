import { IconButton, MenuItem, useTheme } from '@mui/material';
import { useDarkMode } from '../../context/darkModeContext';
import Icon from '../icon/icon';

const label = (darkMode) => (darkMode ? 'Light mode' : 'Dark mode');
const variant = (darkMode) => (darkMode ? 'light' : 'dark');

export const ThemeToggle = () => {
    const { darkMode, toggleDarkMode } = useDarkMode();
    const theme = useTheme();

    return (
        <IconButton
            aria-label={label(darkMode)}
            onClick={toggleDarkMode}
            sx={{ padding: 0, color: theme.palette.text.primary }}
        >
            <Icon variant={variant(darkMode)} className='theme' />
        </IconButton>
    );
};

export const ThemeMenuItem = ({ onSelect }) => {
    const { darkMode, toggleDarkMode } = useDarkMode();

    return (
        <MenuItem onClick={() => { toggleDarkMode(); onSelect(); }}>
            <Icon variant={variant(darkMode)} className='theme' />
            {label(darkMode)}
        </MenuItem>
    );
};
