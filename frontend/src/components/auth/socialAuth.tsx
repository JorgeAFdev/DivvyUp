import GoogleButton from './googleButton';
import styles from './socialAuth.module.css';

const SocialAuth = () => (
    <div className={styles.socialAuth}>
        <GoogleButton label="Continue with Google" />
        <div className={styles.divider}>
            <span>or</span>
        </div>
    </div>
);

export default SocialAuth;
