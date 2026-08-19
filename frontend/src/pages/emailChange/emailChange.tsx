import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdMarkEmailUnread } from 'react-icons/md';
import { useAuth } from '../../context/userContextAuth';
import { getPendingEmailChange, clearPendingEmailChange } from '../../utils/pendingEmailChange';
import styles from '../emailVerified/emailVerified.module.css';

// Both steps of an email change land here (Better Auth reuses one callbackURL),
// and only the second one leaves the session on the new address. Matching it
// against the pending target is therefore the only way to tell the change is
// done and skip the "check your inbox" copy below.
const EmailChange = () => {
    const { user, isPending } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isPending) return;
        const pending = getPendingEmailChange();
        if (pending && user?.email?.toLowerCase() === pending) {
            clearPendingEmailChange();
            navigate('/email-verified', { replace: true });
        }
    }, [isPending, user, navigate]);

    return (
        <div className={styles.container}>
            <MdMarkEmailUnread className={styles.icon} aria-hidden />
            <h1 className={styles.title}>Almost there</h1>
            <p className={styles.text}>
                We emailed a link to your new address to finish changing your email. The change takes
                effect once you open it.
            </p>
            <Link to="/profile" className={styles.link}>Go to your profile</Link>
        </div>
    );
};

export default EmailChange;
