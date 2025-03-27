import React from 'react';
import { getUserSession } from '../../../utils/localStorage'; 
import styles from './user.module.css';
import UserEdit from '../../../components/user/userEdit';
import { useDarkMode } from '../../../context/darkModeContext';

const User = () => {
    const user = getUserSession();
    const {darkMode} = useDarkMode();

    if (!user) {
        return <div className={styles.error}>User not found. Please log in.</div>;
    }

    return (
        <div  className={`${styles.userContainer} ${darkMode ? styles.userContainerDark : ''}`}>
            <img
                className={styles.profileImage}
                src={user.profilePicture || 'https://via.placeholder.com/150'}
                alt="Foto de perfil"
            />
            <h1 className={`${styles.title} ${darkMode ? styles.darkTitle : ''}`}>{user.name}</h1>
            <p className={`${styles.text} ${darkMode ? styles.darkText : ''}`}><strong>Email:</strong> {user.email}</p>
            <UserEdit user={user} />

        </div>
    );
};

export default User;
