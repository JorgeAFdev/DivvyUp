import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { toast } from 'react-toastify';
import { authClient } from '../../utils/authClient';
import { nextDestination } from '../../utils/nextDestination';
import { apiErrorMessage } from '../../utils/apiError';
import styles from './googleButton.module.css';

// signIn.social redirects the whole page to Google, so success never returns
// here (the app remounts on the callback, session already set): no navigate, and
// only a failure to start the redirect is handled below.
const GoogleButton = ({ label }: { label: string }) => {
    const { search } = useLocation();
    const [pending, setPending] = useState(false);

    const onClick = async () => {
        setPending(true);
        const { error } = await authClient.signIn.social({
            provider: 'google',
            // Absolute, so Better Auth redirects to the frontend origin after the
            // callback; a relative path resolves against the API origin (:3001).
            callbackURL: `${window.location.origin}${nextDestination(search)}`,
            errorCallbackURL: `${window.location.origin}/login`,
        });
        if (error) {
            setPending(false);
            toast.error(apiErrorMessage(error, 'Could not sign in with Google. Please try again.'));
        }
    };

    return (
        <button type="button" className={styles.googleButton} onClick={onClick} disabled={pending}>
            <FcGoogle aria-hidden className={styles.googleIcon} />
            {label}
        </button>
    );
};

export default GoogleButton;
