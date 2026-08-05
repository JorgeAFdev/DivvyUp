import { useEffect } from 'react';
import styles from './grouplist.module.css';
import { getGroupByUserId } from '../../../utils/groupApi';
import Group from '../group/group';
import ListSection from '../../listSection/listSection';
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
        <ListSection
            isEmpty={!groups?.length}
            emptyMessage="There are no groups"
            listClassName={styles.list}
        >
            {groups?.map((group) => (
                <Group key={group._id} group={group} setGroups={setGroups} />
            ))}
        </ListSection>
    );
};

export default GroupList;
