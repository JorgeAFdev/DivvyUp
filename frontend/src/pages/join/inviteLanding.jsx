import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { getInviteName } from '../../utils/groupApi';
import styles from './join.module.css';

// What someone without a session sees when they follow an invite link. The
// group name comes from the public endpoint, so a link that was already reset
// says so here instead of after making them register.
const InviteLanding = () => {
    const { inviteCode } = useParams();
    const next = encodeURIComponent(`/join/${inviteCode}`);

    const { data: invite, isLoading, isError } = useQuery({
        queryKey: ['inviteName', inviteCode],
        queryFn: () => getInviteName(inviteCode),
        retry: 0,
    });

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

    return (
        <div className={styles.card}>
            <h2 className={styles.title}>You have been invited to {invite.name}</h2>
            <p className={styles.text}>
                DivvyUp keeps track of who paid what in a group and who owes whom. Sign in to pick
                yourself from the member list, and you will come straight back here.
            </p>
            <div className={styles.actions}>
                <Button variant="contained" component={Link} to={`/login?next=${next}`} id="invite-login">
                    Sign in
                </Button>
                <Button variant="outlined" component={Link} to={`/register?next=${next}`} id="invite-register">
                    Create account
                </Button>
            </div>
        </div>
    );
};

export default InviteLanding;
