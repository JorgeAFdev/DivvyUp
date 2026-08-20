import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DarkModeContextProvider } from '../../context/darkModeContext';
import Header, { MOBILE_QUERY } from './header';

vi.mock('../notifications/notifications', () => ({ default: () => null }));

// Identity now comes from the Better Auth session via useAuth, not localStorage.
const authState = vi.hoisted(() => ({
    user: null as { id: string; name: string; image: string | null } | null,
    isPending: false,
}));
vi.mock('../../context/userContextAuth', () => ({
    useAuth: () => ({ ...authState, signOut: vi.fn() }),
}));

const matchMediaAs = (viewport: 'mobile' | 'desktop') => (query: string): MediaQueryList => ({
    matches: viewport === 'mobile' && query === MOBILE_QUERY,
    media: query,
    addEventListener: () => { },
    removeEventListener: () => { },
    addListener: () => { },
    removeListener: () => { },
    dispatchEvent: () => false,
    onchange: null,
});

const renderHeader = ({ viewport = 'desktop', logged = true }: { viewport?: 'mobile' | 'desktop'; logged?: boolean } = {}) => {
    window.matchMedia = vi.fn().mockImplementation(matchMediaAs(viewport));

    authState.isPending = false;
    authState.user = logged ? { id: '1', name: 'Ana', image: '' } : null;

    return render(
        <MemoryRouter>
            <DarkModeContextProvider>
                <Header />
            </DarkModeContextProvider>
        </MemoryRouter>,
    );
};

afterEach(() => {
    authState.user = null;
    authState.isPending = false;
    // The dark-mode context persists its choice in localStorage; the toggle test
    // would otherwise leak dark mode into the next test's default.
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

        // Logout goes last and behind its own divider on purpose: it is
        // destructive (it ends the session and navigates home), and Profile
        // used to sit right on top of it in a touch target.
        expect(screen.getAllByRole('menuitem').map((item) => item.textContent))
            .toEqual(['Groups', 'Expenses', 'Profile', 'Dark mode', 'Logout']);
    });

    it('keeps the collapsed menu open when the theme is toggled', () => {
        renderHeader({ viewport: 'mobile' });

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Dark mode' }));

        // The label flipping is the confirmation, and closing would throw it
        // away. Every other item in this menu leaves; this one is a switch.
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Light mode' })).toBeInTheDocument();
    });

    it('closes the collapsed menu with Escape', () => {
        renderHeader({ viewport: 'mobile' });

        const button = screen.getByRole('button', { name: 'Open menu' });
        fireEvent.click(button);
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

        expect(button).toHaveAttribute('aria-expanded', 'false');
    });
});
