import { createTheme, ThemeProvider } from '@mui/material';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const DarkModeContext = createContext();

// Deferred to App.css rather than restated here: MUI defaults Button and
// IconButton to duration.short (250ms), and emotion emits the var() untouched
// for the browser to resolve, so the duration stays a single declaration.
const THEME_TRANSITION = 'var(--theme-transition)';

// Grow writes its own opacity/transform transition inline on the menu paper and
// leaves it there, which outranks any stylesheet and would make the open menu
// the one surface that snaps between themes. Handing it back once the menu has
// finished opening is safe: Grow sets it again on the way out.
const releaseGrowTransition = (node) => {
    node.style.transition = '';
};

export const useDarkMode = () => {
    return useContext(DarkModeContext);
};

export const DarkModeContextProvider = ({ children }) => {
    const initialDarkMode = localStorage.getItem("darkMode") === 'true';

    const [darkMode, setDarkMode] = useState(initialDarkMode);

    useEffect(() => {
        if (darkMode) {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
        localStorage.setItem("darkMode", darkMode);
    }, [darkMode]);

    const toggleDarkMode = () => setDarkMode(prev => !prev);

    const theme = useMemo(() =>
        createTheme({
            cssVariables: true,
            palette: {
                mode: darkMode ? 'dark' : 'light',
                primary: { main: '#1e90ff', dark: '#3c8ccd' },
                ...(darkMode
                    ? {
                        background: { color: '#333333', default: '#1a1a1a' },
                        text: { primary: '#FAFAFA' },
                        action: { hover: '#09090b' },
                    }
                    : {
                        background: { color: '#FAFAFA', default: '#ffffff' },
                        text: { primary: '#000000' },
                        action: { hover: '#f0f0f0' },
                    }),
            },
            components: {
                MuiButton: {
                    styleOverrides: {
                        root: { transition: `${THEME_TRANSITION}, box-shadow var(--transition-base)` },
                    },
                },
                MuiIconButton: {
                    styleOverrides: { root: { transition: THEME_TRANSITION } },
                },
                MuiAvatar: {
                    styleOverrides: { root: { transition: THEME_TRANSITION } },
                },
                MuiMenu: {
                    defaultProps: { slotProps: { transition: { onEntered: releaseGrowTransition } } },
                    styleOverrides: { paper: { transition: THEME_TRANSITION } },
                },
            },
        })
        , [darkMode]);

    return <DarkModeContext.Provider value={{ darkMode, toggleDarkMode }}>
        <ThemeProvider theme={theme}>
            {children}
        </ThemeProvider>
    </DarkModeContext.Provider>;
};