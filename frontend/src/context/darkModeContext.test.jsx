import { render, waitFor } from '@testing-library/react';
import { Menu, MenuItem } from '@mui/material';
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

    // Grow sets an inline transition on the paper as it opens and never takes
    // it back, and an inline style beats the stylesheet. Without the release an
    // open menu is the only surface in the app that snaps between themes.
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
