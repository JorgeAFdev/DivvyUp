import { useEffect } from 'react';
import { toast } from 'react-toastify';
import styles from './grouplist.module.css';
import Group from '../group/group';
import ListSection from '../../listSection/listSection';
import { useGroups } from '../../../hooks/useGroups';

const GroupList = () => {
    const { data: groups, isLoading, isError, error } = useGroups();

    useEffect(() => {
        if (isError) {
            toast.error(error.response?.data?.error || 'there was an error loading your groups');
        }
    }, [isError, error]);

    if (isLoading) {
        return <p className={styles.text}>Loading your groups...</p>;
    }

    return (
        <ListSection
            emptyMessage="There are no groups"
            listClassName={styles.list}
        >
            {groups?.map((group) => (
                <Group key={group._id} group={group} />
            ))}
        </ListSection>
    );
};

export default GroupList;
