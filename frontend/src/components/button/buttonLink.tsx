import { Link } from "react-router-dom";
import type { LinkProps } from "react-router-dom";
import styles from "./button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonLinkProps extends LinkProps {
    variant?: ButtonVariant;
    size?: ButtonSize;
}

// A router Link that wears Button's look. Navigation stays a real <a> (right
// click, open in a new tab, keyboard), which a <button> would break, while the
// shared button.module.css keeps the two in one visual language.
const ButtonLink = ({ variant = "primary", size = "md", className, children, ...rest }: ButtonLinkProps) => (
    <Link
        className={`${styles.button} ${styles[variant]} ${styles[size]} ${className ?? ""}`.trim()}
        {...rest}
    >
        {children}
    </Link>
);

export default ButtonLink;
