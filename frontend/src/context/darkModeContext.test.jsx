import { render } from '@testing-library/react';
import { DarkModeContextProvider } from './darkModeContext';

const rootVar = (name) =>
    [...document.styleSheets]
        .flatMap((sheet) => [...(sheet.cssRules || [])])
        .filter((rule) => rule.selectorText === ':root')
        .map((rule) => rule.style.getPropertyValue(name))
        .filter(Boolean);

describe('theme css variables', () => {
    it('defines the primary palette on :root', () => {
        render(<DarkModeContextProvider><span>content</span></DarkModeContextProvider>);

        expect(rootVar('--mui-palette-primary-main')).toContain('#1e90ff');
        expect(rootVar('--mui-palette-primary-dark')).toContain('#3c8ccd');
    });
});
