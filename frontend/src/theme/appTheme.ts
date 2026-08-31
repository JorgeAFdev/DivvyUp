import { createTheme, type PaletteOptions } from '@mui/material';

const THEME_TRANSITION = 'var(--theme-transition)';

// Grow leaves its own inline transition on the paper, and an inline style beats
// the stylesheet. Without this the open menu is the one surface that snaps.
const releaseGrowTransition = (node: HTMLElement) => {
    node.style.transition = '';
};

// Not getComputedStyle: the theme is built during render and the `dark` class
// lands in an effect, so in dark mode the computed value is still the light one.
const declarationsFor = (selector: string): CSSStyleDeclaration[] => {
    const found: CSSStyleDeclaration[] = [];

    for (const sheet of document.styleSheets) {
        let rules: CSSRuleList | undefined;
        try {
            rules = sheet.cssRules;
        } catch {
            continue; // cross-origin sheet, nothing of ours lives there
        }
        for (const rule of rules ?? []) {
            if (rule instanceof CSSStyleRule && rule.selectorText === selector) {
                found.push(rule.style);
            }
        }
    }

    return found;
};

const firstValue = (declarations: CSSStyleDeclaration[], name: string): string => {
    for (const declaration of declarations) {
        const value = declaration.getPropertyValue(name).trim();
        if (value) return value;
    }
    return '';
};

// Resolved here because the palette cannot hold a var(): MUI parses these to
// derive contrastText and the "R G B" channels its hovers compose with.
const readPalette = (darkMode: boolean): PaletteOptions => {
    const base = declarationsFor(':root');
    const overrides = darkMode ? declarationsFor('body.dark') : [];

    const read = (name: string): string => {
        const value = firstValue(overrides, name) || firstValue(base, name);
        if (!value) {
            throw new Error(`appTheme: ${name} is not declared in App.css`);
        }
        return value;
    };

    return {
        mode: darkMode ? 'dark' : 'light',
        primary: { main: read('--primary-color'), dark: read('--primary-color-dark') },
        background: { default: read('--bg-color'), paper: read('--secondary-bg-color') },
        text: { primary: read('--color'), secondary: read('--placeholder-color') },
        divider: read('--border-color'),
    };
};

export const createAppTheme = (darkMode: boolean) =>
    createTheme({
        cssVariables: true,
        palette: readPalette(darkMode),
        // A var() works here (unlike the palette) because MUI copies it into
        // CSS. Without it MUI's Roboto default wins on Avatar, MenuItem, Tooltip.
        typography: { fontFamily: 'var(--font-body)' },
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
            // Hover only: a menu item is transparent at rest and inherits its colour.
            MuiMenuItem: {
                styleOverrides: { root: { transition: 'background-color var(--transition-base)' } },
            },
        },
    });
