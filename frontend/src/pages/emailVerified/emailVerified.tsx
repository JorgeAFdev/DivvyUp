import { MdCheckCircleOutline } from 'react-icons/md';
import styles from './emailVerified.module.css';
import ButtonLink from '../../components/button/buttonLink';

const EmailVerified = () => (
    <div className={styles.container}>
        <MdCheckCircleOutline className={styles.icon} aria-hidden />
        <h1 className={styles.title}>Email verified</h1>
        <p className={styles.text}>Your email address has been confirmed.</p>
        <ButtonLink to="/groups">Go to your groups</ButtonLink>
    </div>
);

export default EmailVerified;
