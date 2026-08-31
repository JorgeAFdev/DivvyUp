import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DarkModeContextProvider } from '../../context/darkModeContext';
import Landing from './landing';

// useAuth reads the session straight off Better Auth's store, so that is the
// seam: mocking useAuth itself would stop testing the wiring under test.
const session = vi.hoisted(() => ({
    data: null as { user: { id: string; name: string } } | null,
    isPending: false,
}));
vi.mock('../../utils/authClient', () => ({
    authClient: { useSession: () => session, signOut: vi.fn() },
}));
vi.mock('../../components/notifications/notifications', () => ({ default: () => null }));

const renderLanding = () => render(
    <MemoryRouter initialEntries={['/']}>
        <DarkModeContextProvider>
            <Landing />
        </DarkModeContextProvider>
    </MemoryRouter>,
);

afterEach(() => {
    session.data = null;
    session.isPending = false;
    localStorage.clear();
});

describe('The landing page', () => {
    it('renders nothing while the session is still being checked', () => {
        session.isPending = true;

        const { container } = renderLanding();

        // Header renders nothing until the session resolves, so painting before
        // then would drop the hero in and shove it down a moment later.
        expect(container).toBeEmptyDOMElement();
    });

    it('renders the landing to a logged-out visitor, with the guest nav', () => {
        renderLanding();

        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
        expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
    });

    // The landing is public on purpose: a visitor with a session reads the same
    // page, and the header is what tells them they are signed in.
    it('renders the landing to a logged-in visitor, with the app nav', () => {
        session.data = { user: { id: '1', name: 'Ana' } };

        renderLanding();

        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Groups' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    });
});
