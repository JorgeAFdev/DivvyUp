import { Link } from 'react-router-dom';
import { MdCheckCircleOutline } from 'react-icons/md';
import styles from './emailVerified.module.css';

const EmailVerified = () => (
    <div className={styles.container}>
        <MdCheckCircleOutline className={styles.icon} aria-hidden />
        <h1 className={styles.title}>Email verified</h1>
        <p className={styles.text}>Your email address has been confirmed.</p>
        <Link to="/groups" className={styles.link}>Go to your groups</Link>
    </div>
);

export default EmailVerified;
