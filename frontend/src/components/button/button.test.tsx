import { fireEvent, render, screen } from '@testing-library/react';
import Button from './button';

describe('The button component', () => {
    it('defaults to type="button" so it never submits a form by accident', () => {
        render(<Button>Save</Button>);

        expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
    });

    it('passes type="submit" through when asked', () => {
        render(<Button type="submit">Save</Button>);

        expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('defaults to the primary variant', () => {
        render(<Button>Save</Button>);

        expect(screen.getByRole('button')).toHaveClass('button', 'primary');
    });

    it.each(['primary', 'secondary', 'ghost'] as const)('carries the %s variant class', (variant) => {
        render(<Button variant={variant}>Save</Button>);

        expect(screen.getByRole('button')).toHaveClass('button', variant);
    });

    it('defaults to the md size', () => {
        render(<Button>Save</Button>);

        expect(screen.getByRole('button')).toHaveClass('button', 'md');
    });

    it.each(['sm', 'md', 'lg'] as const)('carries the %s size class', (size) => {
        render(<Button size={size}>Save</Button>);

        expect(screen.getByRole('button')).toHaveClass('button', size);
    });

    it('keeps the base class alongside a caller className', () => {
        render(<Button className="wide">Save</Button>);

        expect(screen.getByRole('button')).toHaveClass('button', 'primary', 'wide');
    });

    it('forwards native button props like onClick and disabled', () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick} disabled>Save</Button>);
        const button = screen.getByRole('button');

        fireEvent.click(button);

        expect(button).toBeDisabled();
        expect(onClick).not.toHaveBeenCalled();
    });

    it('marks the button busy and disabled while loading, without a click getting through', () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick} loading>Save</Button>);
        const button = screen.getByRole('button');

        fireEvent.click(button);

        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(button).toBeDisabled();
        expect(onClick).not.toHaveBeenCalled();
    });

    it('keeps its accessible name while loading, so the spinner does not erase the label', () => {
        render(<Button loading>Save</Button>);

        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('is not busy when idle', () => {
        render(<Button>Save</Button>);

        expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy');
    });
});
