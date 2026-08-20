import { render } from '@testing-library/react';
import { MdEdit } from 'react-icons/md';
import Icon from './icon';

const svgOf = (container: HTMLElement) => container.querySelector('svg');

describe('The icon component', () => {
    it('renders the glyph it is handed', () => {
        const { container } = render(<Icon icon={MdEdit} />);

        expect(svgOf(container)).toBeInTheDocument();
    });

    it('carries the base class and merges an extra className', () => {
        const { container } = render(<Icon icon={MdEdit} className="extra" />);

        expect(svgOf(container)).toHaveClass('icon', 'extra');
    });

    it('defaults to size 18 and honours an explicit size', () => {
        const { container: byDefault } = render(<Icon icon={MdEdit} />);
        expect(svgOf(byDefault)).toHaveAttribute('height', '18');

        const { container: sized } = render(<Icon icon={MdEdit} size={25} />);
        expect(svgOf(sized)).toHaveAttribute('height', '25');
    });

    it('forwards id and data-type to the svg', () => {
        const { container } = render(<Icon icon={MdEdit} id="deleteGroup" data-type="dots" />);
        const svg = svgOf(container)!;

        expect(svg).toHaveAttribute('id', 'deleteGroup');
        expect(svg).toHaveAttribute('data-type', 'dots');
    });
});
