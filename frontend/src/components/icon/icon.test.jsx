import { fireEvent, render } from '@testing-library/react';
import Icon from './icon';

const svgOf = (container) => container.querySelector('svg');

const htmlFor = (variant) => svgOf(render(<Icon variant={variant} />).container).innerHTML;

// Every variant but 'add', which is the fallback these are compared against.
const VARIANTS = ['edit', 'delete', 'light', 'dark', 'dots', 'share', 'refresh', 'menu'];

describe('The icon component', () => {
    it('tags the rendered icon with the variant it was asked for', () => {
        const { container } = render(<Icon variant="menu" />);

        expect(svgOf(container)).toHaveAttribute('data-type', 'menu');
    });

    // A variant whose import gets dropped does not throw: iconsByVariant[variant]
    // is undefined and it degrades to the add icon, silently and everywhere.
    it.each(VARIANTS)('renders an icon of its own for %s', (variant) => {
        expect(htmlFor(variant)).not.toBe(htmlFor('add'));
    });

    it('falls back to the add icon for an unknown variant', () => {
        expect(htmlFor('nope')).toBe(htmlFor('add'));
    });

    it('defaults to the add icon with no variant', () => {
        const { container } = render(<Icon />);

        expect(svgOf(container).innerHTML).toBe(htmlFor('add'));
    });

    it('calls handleClick when clicked', () => {
        const handleClick = vi.fn();
        const { container } = render(<Icon variant="dots" handleClick={handleClick} />);

        fireEvent.click(svgOf(container));

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('carries the base class plus the one the className names', () => {
        const { container } = render(<Icon variant="dark" className="theme" />);

        expect(svgOf(container)).toHaveClass('icon', 'theme');
    });
});
