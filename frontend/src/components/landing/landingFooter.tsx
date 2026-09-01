import styles from './landingFooter.module.css';

const REPO_URL = 'https://github.com/JorgeAFdev/DivvyUp';

const LandingFooter = () => (
    <footer className={styles.footer}>
        <div className={styles.inner}>
            <img src="/assets/logo.png" alt="DivvyUp" className={styles.logo} />
            <a className={styles.link} href={REPO_URL} target="_blank" rel="noreferrer">
                Source on GitHub
            </a>
            <p className={styles.credits}>
                Originally created by Jorge Álvarez &amp; Alex Biescas · Further developed by Jorge Álvarez
            </p>
        </div>
    </footer>
);

export default LandingFooter;
