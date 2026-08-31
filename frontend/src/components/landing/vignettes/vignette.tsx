import type { ReactNode } from 'react';
import styles from './vignettes.module.css';

// aria-hidden as a whole: each vignette is a faux screenshot of the feature its
// row's heading and copy already describe.
export const Vignette = ({ children }: { children: ReactNode }) => (
    <div className={styles.vignette} aria-hidden="true">{children}</div>
);

export const VignetteLabel = ({ children }: { children: ReactNode }) => (
    <p className={styles.label}>{children}</p>
);
