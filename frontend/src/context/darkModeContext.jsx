import { createTheme, ThemeProvider } from '@mui/material';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const DarkModeContext = createContext();

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
            palette: {
                mode: darkMode ? 'dark' : 'light',
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
        })
        , [darkMode]);

    return <DarkModeContext.Provider value={{ darkMode, toggleDarkMode }}>
        <ThemeProvider theme={theme}>
            {children}
        </ThemeProvider>
    </DarkModeContext.Provider>;
};