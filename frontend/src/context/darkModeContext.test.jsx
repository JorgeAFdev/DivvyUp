import { render, waitFor } from '@testing-library/react';
import { Menu, MenuItem } from '@mui/material';
import { DarkModeContextProvider } from './darkModeContext';
import { createAppTheme } from '../theme/appTheme';

const rootVar = (name) =>
    [...document.styleSheets]
        .flatMap((sheet) => [...(sheet.cssRules || [])])
        .filter((rule) => rule.selectorText === ':root')
        .map((rule) => rule.style.getPropertyValue(name))
        .filter(Boolean);

const declaredInCss = (name, darkMode) => {
    const rules = [...document.styleSheets].flatMap((sheet) => [...(sheet.cssRules || [])]);
    const from = (selector) => rules
        .filter((rule) => rule.selectorText === selector)
        .map((rule) => rule.style.getPropertyValue(name).trim())
        .find(Boolean);

    return (darkMode && from('body.dark')) || from(':root');
};

// No hex is written here on purpose: restating them would make this a third
// place the palette lives, which is what the wiring exists to remove.
const WIRED = [
    ['--mui-palette-primary-main', '--primary-color'],
    ['--mui-palette-primary-dark', '--primary-color-dark'],
    ['--mui-palette-text-primary', '--color'],
    ['--mui-palette-text-secondary', '--placeholder-color'],
    ['--mui-palette-background-default', '--bg-color'],
    ['--mui-palette-background-paper', '--secondary-bg-color'],
    ['--mui-palette-divider', '--border-color'],
];

describe('the palette comes from App.css', () => {
    afterEach(() => localStorage.clear());

    describe.each([['light', false], ['dark', true]])('in %s mode', (theme, darkMode) => {
        it.each(WIRED)('publishes %s from %s', (muiVar, cssVar) => {
            localStorage.setItem('darkMode', String(darkMode));

            render(<DarkModeContextProvider><span>content</span></DarkModeContextProvider>);

            const fromCss = declaredInCss(cssVar, darkMode);

            expect(fromCss).toBeTruthy();
            expect(rootVar(muiVar)).toContain(fromCss);
        });
    });

    // A default here would put a colour back into JS by the back door.
    it('refuses to build a theme whose colours are not declared', () => {
        const sheets = [...document.querySelectorAll('style')];
        sheets.forEach((s) => s.remove());

        expect(() => createAppTheme(false)).toThrow(/--primary-color is not declared in App\.css/);

        sheets.forEach((s) => document.head.appendChild(s));
    });
});

describe('theme transitions', () => {
    it('leaves an open menu paper free of the inline transition Grow writes', async () => {
        render(
            <DarkModeContextProvider>
                <Menu open anchorEl={document.body}><MenuItem>Groups</MenuItem></Menu>
            </DarkModeContextProvider>,
        );

        const paper = document.querySelector('.MuiMenu-paper');

        await waitFor(() => expect(paper.style.transition).toBe(''));
    });
});
