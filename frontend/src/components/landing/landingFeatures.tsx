import type { ReactNode } from 'react';
import LandingSection from './landingSection';
import styles from './landingFeatures.module.css';

const FEATURES_TITLE_ID = 'landing-features-title';

// Separate from the row so the row never knows which side it falls on: the
// alternation is an nth-child rule in this stylesheet, not a prop.
const LandingFeatures = ({ children }: { children: ReactNode }) => (
    <LandingSection labelledBy={FEATURES_TITLE_ID} className={styles.features}>
        <h2 className={styles.srOnly} id={FEATURES_TITLE_ID}>What DivvyUp does</h2>
        <div className={styles.rows}>{children}</div>
    </LandingSection>
);

export default LandingFeatures;
