import { useEffect } from 'react';
import styles from './grouplist.module.css';
import { getGroupByUserId } from '../../../utils/groupApi';
import Group from '../group/group';
import { useAuth } from '../../../context/userContextAuth';

const GroupList = ({ groups, setGroups }) => {
    useEffect(() => {
        getGroups();
    }, []);

    const { token } = useAuth();

    const getGroups = async () => {
        try {
            const data = await getGroupByUserId(token);
            setGroups(data);
        } catch (error) {
            console.log(error.response.data.error)
        }
    };

    return (
        <section className={styles.groups}>
            {groups.length === 0 ? (<p className={styles.text}>There are no groups</p>) : (
                <ul className={styles.list}>
                    {groups.map((group) => (
                        <Group key={group._id} group={group} setGroups={setGroups} />
                    ))}
                </ul>
            )}
        </section>
    );
};

export default GroupList;