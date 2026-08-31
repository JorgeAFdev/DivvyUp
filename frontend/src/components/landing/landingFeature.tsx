import type { ReactNode } from 'react';
import styles from './landingFeatures.module.css';

interface LandingFeatureProps {
    eyebrow: string;
    title: string;
    body: string;
    /** The row's visual: one of the vignettes. */
    children: ReactNode;
}

const LandingFeature = ({ eyebrow, title, body, children }: LandingFeatureProps) => (
    <article className={styles.row}>
        <div className={styles.copy}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.body}>{body}</p>
        </div>
        <div className={styles.figure}>{children}</div>
    </article>
);

export default LandingFeature;
