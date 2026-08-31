import type { ReactNode } from 'react';
// Only .shell applies these, so an app screen parses the two @font-face rules
// and downloads neither. The body and mono faces are app-wide, in App.tsx.
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import styles from './landingShell.module.css';

const LandingShell = ({ children }: { children: ReactNode }) => (
    <div className={styles.shell}>{children}</div>
);

export default LandingShell;
