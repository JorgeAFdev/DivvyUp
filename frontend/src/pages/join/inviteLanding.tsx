import { useParams } from 'react-router-dom';
import ButtonLink from '../../components/button/buttonLink';
import { useInviteName } from '../../hooks/useInvite';
import styles from './join.module.css';

// What someone without a session sees when they follow an invite link. The
// group name comes from the public endpoint, so a link that was already reset
// says so here instead of after making them register.
const InviteLanding = () => {
    const { inviteCode = '' } = useParams();
    const next = encodeURIComponent(`/join/${inviteCode}`);

    const { data: invite, isLoading, isError } = useInviteName(inviteCode);

    if (isLoading) {
        return <p className={styles.text}>Loading invite...</p>;
    }

    if (isError) {
        return (
            <div className={styles.card}>
                <h2 className={styles.title}>This invite link is not valid</h2>
                <p className={styles.text}>
                    Whoever shared it may have reset the link. Ask them for the current one.
                </p>
            </div>
        );
    }

    if (!invite) {
        return null;
    }

    return (
        <div className={styles.card}>
            <h2 className={styles.title}>You have been invited to {invite.name}</h2>
            <p className={styles.text}>
                DivvyUp keeps track of who paid what in a group and who owes whom. Sign in to pick
                yourself from the member list, and you will come straight back here.
            </p>
            <div className={styles.actions}>
                <ButtonLink size="sm" to={`/login?next=${next}`} id="invite-login">
                    Sign in
                </ButtonLink>
                <ButtonLink variant="secondary" size="sm" to={`/register?next=${next}`} id="invite-register">
                    Create account
                </ButtonLink>
            </div>
        </div>
    );
};

export default InviteLanding;
