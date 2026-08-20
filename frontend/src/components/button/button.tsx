import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import styles from "./button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = "primary", size = "md", type = "button", loading = false, disabled, className, children, ...rest }, ref) => (
        <button
            ref={ref}
            type={type}
            className={`${styles.button} ${styles[variant]} ${styles[size]} ${className ?? ""}`.trim()}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...rest}
        >
            <span className={loading ? styles.loadingLabel : undefined}>{children}</span>
            {loading && <span className={styles.spinner} aria-hidden="true" />}
        </button>
    )
);

Button.displayName = "Button";

export default Button;
