import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Button from '../../components/button/button';
import ButtonLink from '../../components/button/buttonLink';
import { useAuth } from '../../context/userContextAuth';
import { useInvite, useJoinGroup } from '../../hooks/useInvite';
import type { JoinGroupInput } from '../../utils/groupApi';
import { apiErrorMessage } from '../../utils/apiError';
import InviteLanding from './inviteLanding';
import styles from './join.module.css';

const Join = () => {
    const { inviteCode = '' } = useParams();
    const { user, isPending } = useAuth();
    const navigate = useNavigate();

    const [newName, setNewName] = useState('');
    const [isNaming, setIsNaming] = useState(false);

    const { data: group, isLoading, isError, error } = useInvite(inviteCode);

    const mutation = useJoinGroup(inviteCode);

    const join = (body: JoinGroupInput) => {
        mutation.mutate(body, {
            onSuccess: (joined) => {
                toast.success(`You are now part of ${joined.name}`);
                navigate(`/groups/${joined._id}/expenses`);
            },
            onError: (mutationError) => {
                toast.error(apiErrorMessage(mutationError, 'Could not join this group'));
            },
        });
    };

    if (isPending) {
        return null;
    }

    if (!user) {
        return <InviteLanding />;
    }

    if (isLoading) {
        return <p className={styles.text}>Loading invite...</p>;
    }

    if (isError) {
        return (
            <div className={styles.card}>
                <h2 className={styles.title}>This invite link is not valid</h2>
                <p className={styles.text}>
                    {apiErrorMessage(error, 'Ask whoever shared it for the current link.')}
                </p>
                <ButtonLink size="sm" to="/groups">Go to my groups</ButtonLink>
            </div>
        );
    }

    if (!group) {
        return null;
    }

    if (group.alreadyMember) {
        return (
            <div className={styles.card}>
                <h2 className={styles.title}>You are already in {group.name}</h2>
                <ButtonLink size="sm" to={`/groups/${group._id}/expenses`}>
                    Open the group
                </ButtonLink>
            </div>
        );
    }

    return (
        <div className={styles.card}>
            <h2 className={styles.title}>Join {group.name}</h2>
            <p className={styles.text}>{group.description}</p>

            {group.members.length > 0 ? (
                <>
                    <p className={styles.label}>Which one is you?</p>
                    <ul className={styles.members}>
                        {group.members.map((member) => (
                            <li key={member._id}>
                                <button
                                    type="button"
                                    className={styles.member}
                                    disabled={mutation.isPending}
                                    onClick={() => join({ memberId: member._id })}
                                    id={`claim-${member._id}`}
                                >
                                    {member.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            ) : (
                <p className={styles.text}>Everyone on the list has an account already.</p>
            )}

            {isNaming ? (
                <form
                    className={styles.newMember}
                    onSubmit={(event) => {
                        event.preventDefault();
                        join({ name: newName });
                    }}
                >
                    <input
                        className={styles.input}
                        placeholder="Your name"
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                        autoFocus
                        id="new-member-name"
                    />
                    <Button size="sm" type="submit" disabled={!newName.trim()} loading={mutation.isPending}>
                        Join
                    </Button>
                </form>
            ) : (
                <Button variant="ghost" type="button" onClick={() => setIsNaming(true)} id="not-on-the-list">
                    I am not on the list
                </Button>
            )}
        </div>
    );
};

export default Join;
