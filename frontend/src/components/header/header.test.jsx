import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/userContextAuth';
import { DarkModeContextProvider } from '../../context/darkModeContext';
import Header, { MOBILE_QUERY } from './header';

jest.mock('../notifications/notifications', () => () => null);

const matchMediaAs = (viewport) => (query) => ({
    matches: viewport === 'mobile' && query === MOBILE_QUERY,
    media: query,
    addEventListener: () => { },
    removeEventListener: () => { },
    addListener: () => { },
    removeListener: () => { },
    dispatchEvent: () => false,
    onchange: null,
});

const renderHeader = ({ viewport = 'desktop', logged = true } = {}) => {
    window.matchMedia = jest.fn().mockImplementation(matchMediaAs(viewport));

    if (logged) {
        localStorage.setItem('user-session', JSON.stringify({
            token: 'a-token',
            user: { id: '1', name: 'Ana', profilePicture: '' },
        }));
    }

    return render(
        <MemoryRouter>
            <AuthProvider>
                <DarkModeContextProvider>
                    <Header />
                </DarkModeContextProvider>
            </AuthProvider>
        </MemoryRouter>,
    );
};

afterEach(() => {
    localStorage.clear();
});

describe('The header component', () => {
    it('shows the auth links and no menu button when there is no session', () => {
        renderHeader({ logged: false, viewport: 'mobile' });

        expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
    });

    it('keeps the navigation inline on desktop', () => {
        renderHeader({ viewport: 'desktop' });

        expect(screen.getByRole('link', { name: 'Groups' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Expenses' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
    });

    it('exposes the theme toggle as a labelled button', () => {
        renderHeader({ viewport: 'desktop' });

        const toggle = screen.getByRole('button', { name: 'Dark mode' });
        fireEvent.click(toggle);

        expect(screen.getByRole('button', { name: 'Light mode' })).toBeInTheDocument();
    });

    it('collapses the navigation behind the menu button on mobile', () => {
        renderHeader({ viewport: 'mobile' });

        expect(screen.queryByRole('link', { name: 'Groups' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Expenses' })).not.toBeInTheDocument();

        const button = screen.getByRole('button', { name: 'Open menu' });
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens the collapsed menu with the navigation, the account and the theme toggle', () => {
        renderHeader({ viewport: 'mobile' });

        const button = screen.getByRole('button', { name: 'Open menu' });
        fireEvent.click(button);

        expect(button).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('menuitem', { name: 'Groups' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Expenses' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Dark mode' })).toBeInTheDocument();
    });

    it('closes the collapsed menu with Escape', () => {
        renderHeader({ viewport: 'mobile' });

        const button = screen.getByRole('button', { name: 'Open menu' });
        fireEvent.click(button);
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

        expect(button).toHaveAttribute('aria-expanded', 'false');
    });
});
