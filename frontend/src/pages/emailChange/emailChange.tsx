import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdMarkEmailUnread } from 'react-icons/md';
import ButtonLink from '../../components/button/buttonLink';
import StatusScreen from '../../components/statusScreen/statusScreen';
import { useAuth } from '../../context/userContextAuth';
import { getPendingEmailChange, clearPendingEmailChange } from '../../utils/pendingEmailChange';

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
        <StatusScreen
            icon={MdMarkEmailUnread}
            title="Almost there"
            text="We emailed a link to your new address to finish changing your email. The change takes effect once you open it."
        >
            <ButtonLink to="/profile">Go to your profile</ButtonLink>
        </StatusScreen>
    );
};

export default EmailChange;
