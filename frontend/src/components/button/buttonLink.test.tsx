import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ButtonLink from './buttonLink';

const renderLink = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('The button link', () => {
    it('renders an anchor, not a button, so navigation stays a real link', () => {
        renderLink(<ButtonLink to="/groups">Go</ButtonLink>);
        const link = screen.getByRole('link', { name: 'Go' });

        expect(link.tagName).toBe('A');
        expect(link).toHaveAttribute('href', '/groups');
    });

    it('wears the button look with its variant and size', () => {
        renderLink(<ButtonLink to="/x" variant="secondary" size="sm">Go</ButtonLink>);

        expect(screen.getByRole('link')).toHaveClass('button', 'secondary', 'sm');
    });

    it('defaults to the primary md look', () => {
        renderLink(<ButtonLink to="/x">Go</ButtonLink>);

        expect(screen.getByRole('link')).toHaveClass('button', 'primary', 'md');
    });
});
