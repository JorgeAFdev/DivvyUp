import { useAuth } from '../../../context/userContextAuth';
import styles from './user.module.css';
import MemberAvatar from '../../../components/avatar/memberAvatar';
import UserEdit from '../../../components/user/userEdit';

const User = () => {
    const { user } = useAuth();

    if (!user) {
        return <div className={styles.error}>User not found. Please log in.</div>;
    }

    return (
        <div className={styles.userContainer}>
            <MemberAvatar
                name={user.name}
                src={user.image ?? undefined}
                size={150}
                className={styles.profileImage}
                sx={{ marginInline: 'auto' }}
            />
            <h1 className={styles.text}>{user.name}</h1>
            <p className={styles.text}><strong>Email:</strong> {user.email}</p>
            <UserEdit user={user} />

        </div>
    );
};

export default User;
