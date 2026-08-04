import React from 'react';
import { getUserSession } from '../../../utils/localStorage';
import { Avatar } from '@mui/material';
import styles from './user.module.css';
import { initialsOf } from '../../../utils/members';
import UserEdit from '../../../components/user/userEdit';

const User = () => {
    const user = getUserSession();

    if (!user) {
        return <div className={styles.error}>User not found. Please log in.</div>;
    }

    return (
        <div className={styles.userContainer}>
            <Avatar
                className={styles.profileImage}
                src={user.profilePicture || undefined}
                alt="Foto de perfil"
                sx={{ width: 150, height: 150, margin: '0 auto', fontSize: '3rem' }}
            >
                {initialsOf(user.name)}
            </Avatar>
            <h1 className={styles.text}>{user.name}</h1>
            <p className={styles.text}><strong>Email:</strong> {user.email}</p>
            <UserEdit user={user} />

        </div>
    );
};

export default User;
