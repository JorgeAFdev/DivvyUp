import type { IconType } from "react-icons";
import styles from './icon.module.css';

interface IconProps {
    icon: IconType;
    className?: string;
    size?: number;
    id?: string;
    'data-type'?: string;
}

const Icon = ({ icon: Glyph, className, size = 18, ...rest }: IconProps) => (
    <Glyph className={`${styles.icon}${className ? ` ${className}` : ''}`} size={size} {...rest} />
);

export default Icon;
