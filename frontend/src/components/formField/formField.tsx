import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import styles from './formField.module.css';

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
    id: string;
    label: string;
    error?: FieldError;
    hint?: string;
    trailing?: ReactNode;
}

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
    ({ id, label, error, hint, trailing, ...inputProps }, ref) => {
        const hintId = hint ? `${id}-hint` : undefined;
        const errorId = error ? `${id}-error` : undefined;
        const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

        return (
            <>
                <label htmlFor={id} className={styles.label}>{label}</label>
                <div className={styles.control}>
                    <input
                        id={id}
                        ref={ref}
                        aria-invalid={error ? 'true' : 'false'}
                        aria-describedby={describedBy}
                        className={`${styles.input}${trailing ? ` ${styles.hasTrailing}` : ''}`}
                        {...inputProps}
                    />
                    {trailing}
                </div>
                {hint && <p id={hintId} className={styles.hint}>{hint}</p>}
                {error && <p id={errorId} className={styles.error}>{error.message}</p>}
            </>
        );
    },
);

FormField.displayName = 'FormField';

export default FormField;
