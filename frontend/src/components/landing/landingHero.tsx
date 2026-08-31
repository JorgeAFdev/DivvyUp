import ButtonLink from '../button/buttonLink';
import HeroReceipt from './heroReceipt';
import LandingSection from './landingSection';
import styles from './landingHero.module.css';

const HERO_TITLE_ID = 'landing-hero-title';

const LandingHero = () => (
    <LandingSection labelledBy={HERO_TITLE_ID} className={styles.hero}>
        <div className={styles.grid}>
            <div className={styles.copy}>
                <p className={styles.eyebrow}>Group expenses, settled</p>
                <h1 className={styles.headline} id={HERO_TITLE_ID}>
                    Split expenses,<br />
                    <em>not friendships.</em>
                </h1>
                <p className={styles.subhead}>
                    Track what a group spends, see who owes what at a glance, and settle up
                    without the spreadsheet or the awkward reminder.
                </p>
                <div className={styles.actions}>
                    <ButtonLink to="/register" size="lg">Get started</ButtonLink>
                    <ButtonLink to="/login" variant="secondary" size="lg">Log in</ButtonLink>
                </div>
            </div>

            <div className={styles.figure}>
                <HeroReceipt />
            </div>
        </div>
    </LandingSection>
);

export default LandingHero;
