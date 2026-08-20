import { fireEvent, render, screen } from '@testing-library/react';
import type { FieldError } from 'react-hook-form';
import FormField from './formField';
import PasswordInput from './passwordInput';

const error = { type: 'validate', message: 'Something is wrong' } as FieldError;

describe('FormField', () => {
    it('links the label to the input and reports no error by default', () => {
        render(<FormField id="email" label="Email" />);
        const input = screen.getByLabelText('Email');

        expect(input).toHaveAttribute('id', 'email');
        expect(input).toHaveAttribute('aria-invalid', 'false');
        expect(input).not.toHaveAttribute('aria-describedby');
    });

    it('wires the error message to the input and flags it invalid', () => {
        render(<FormField id="email" label="Email" error={error} />);
        const input = screen.getByLabelText('Email');

        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(input).toHaveAttribute('aria-describedby', 'email-error');
        expect(screen.getByText('Something is wrong')).toHaveAttribute('id', 'email-error');
    });

    it('describes the input by the hint alone, then by hint and error together', () => {
        const { rerender } = render(<FormField id="pw" label="Password" hint="8+ characters" />);
        expect(screen.getByLabelText('Password')).toHaveAttribute('aria-describedby', 'pw-hint');

        rerender(<FormField id="pw" label="Password" hint="8+ characters" error={error} />);
        expect(screen.getByLabelText('Password')).toHaveAttribute('aria-describedby', 'pw-hint pw-error');
    });

    it('forwards native input props like placeholder and the register onChange', () => {
        const onChange = vi.fn();
        render(<FormField id="name" label="Name" placeholder="Your name" onChange={onChange} />);
        const input = screen.getByLabelText('Name');

        fireEvent.change(input, { target: { value: 'Jorge' } });

        expect(input).toHaveAttribute('placeholder', 'Your name');
        expect(onChange).toHaveBeenCalled();
    });
});

describe('PasswordInput', () => {
    it('masks the value and offers to reveal it', () => {
        render(<PasswordInput id="password" label="Password" />);

        expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
        expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute('type', 'button');
    });

    it('reveals the value and flips the toggle label when clicked', () => {
        render(<PasswordInput id="password" label="Password" />);

        fireEvent.click(screen.getByRole('button', { name: 'Show password' }));

        expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
        expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
    });
});
