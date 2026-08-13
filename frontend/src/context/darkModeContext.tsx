import { ThemeProvider } from '@mui/material';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createAppTheme } from '../theme/appTheme';

interface DarkModeContextValue {
    darkMode: boolean;
    toggleDarkMode: () => void;
}

const DarkModeContext = createContext<DarkModeContextValue | undefined>(undefined);

export const useDarkMode = (): DarkModeContextValue => {
    const context = useContext(DarkModeContext);
    if (context === undefined) {
        throw new Error('useDarkMode must be used within a DarkModeContextProvider');
    }
    return context;
};

export const DarkModeContextProvider = ({ children }: { children: ReactNode }) => {
    const initialDarkMode = localStorage.getItem("darkMode") === 'true';

    const [darkMode, setDarkMode] = useState(initialDarkMode);

    useEffect(() => {
        if (darkMode) {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
        localStorage.setItem("darkMode", String(darkMode));
    }, [darkMode]);

    const toggleDarkMode = () => setDarkMode(prev => !prev);

    const theme = useMemo(() => createAppTheme(darkMode), [darkMode]);

    return <DarkModeContext.Provider value={{ darkMode, toggleDarkMode }}>
        <ThemeProvider theme={theme}>
            {children}
        </ThemeProvider>
    </DarkModeContext.Provider>;
};
