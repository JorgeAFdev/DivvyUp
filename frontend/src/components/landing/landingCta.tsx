import ButtonLink from '../button/buttonLink';
import LandingSection from './landingSection';
import styles from './landingCta.module.css';

const CTA_TITLE_ID = 'landing-cta-title';

const LandingCta = () => (
    <LandingSection labelledBy={CTA_TITLE_ID} className={styles.cta}>
        <p className={styles.rule} />
        <h2 className={styles.title} id={CTA_TITLE_ID}>
            Start with your next trip, flat or dinner.
        </h2>
        <p className={styles.body}>Free, open source, and ready in under a minute.</p>
        <ButtonLink to="/register" size="lg">Create your first group</ButtonLink>
    </LandingSection>
);

export default LandingCta;
