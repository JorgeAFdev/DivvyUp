import type { ReactNode } from 'react';
import styles from './landingSection.module.css';

interface LandingSectionProps {
    labelledBy: string;
    className?: string;
    children: ReactNode;
}

const LandingSection = ({ labelledBy, className, children }: LandingSectionProps) => (
    <section
        aria-labelledby={labelledBy}
        className={`${styles.section} ${className ?? ''}`.trim()}
    >
        <div className={styles.inner}>{children}</div>
    </section>
);

export default LandingSection;
