import { useState } from 'react';
import styles from './group.module.css'
import { deleteGroup, updateGroup } from '../../../utils/groupApi';
import { toast } from 'react-toastify';
import GroupActions from '../groupActions/groupActions';
import { useDarkMode } from '../../../context/darkModeContext';
import { useAuth } from '../../../context/userContextAuth';
import { useNavigate } from 'react-router-dom';

const Group = ({ group, setGroups }) => {
    const [expandedGroupId, setExpandedGroupId] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    const toggleMembers = (groupId) => {
        setExpandedGroupId(expandedGroupId === groupId ? null : groupId);
    };

    const navigate = useNavigate();
    const { darkMode } = useDarkMode();
    const { token } = useAuth();

    const groupMembers = group?.members?.map((p) => p.user)

    const handleActionsClick = (e) => {
        e.stopPropagation();
    }

    const handleEditGroup = async (data) => {
        try {
            const response = await updateGroup(group._id, data, token);
            setGroups((prevGroups) => prevGroups.map((g) => (g._id === group._id ? response : g)));
            setIsEditing(false);
            toast.success('Group successfully edited');
        } catch (error) {
            toast.error(error.response.data.error)
        }
    }

    const onDelete = async () => {
        const userConfirmed = window.confirm('Are you sure you want to delete this group?');
        if (!userConfirmed) {
            return;
        }

        try {
            await deleteGroup(group._id, token);
            setGroups((prevGroups) => prevGroups.filter((g) => g._id !== group._id));
            toast.success('Group succesfully deleted')
        } catch (error) {
            toast.error(error.response.data.error)
        }
    };
    return (
        <div className={`${styles.group} ${darkMode ? styles.groupDark : ''}`} id={`group-card-${group._id}`} onClick={() => navigate(`/groups/${group._id}/expenses`)}>
            <li className={styles.listItem}>
                <div className={styles.row} >
                    <div className={styles.left}>
                        <p><strong>{group.name}</strong></p>
                        <p>{group.description}</p>
                    </div>
                    <div className={styles.right} onClick={handleActionsClick}>
                        <GroupActions group={group} groupMembers={groupMembers} editGroup={handleEditGroup} onDelete={onDelete} isEditing={isEditing} setIsEditing={setIsEditing} />
                    </div>
                </div>
                {expandedGroupId === group._id && (
                    <div className={styles.members}>
                        <p><strong>Members</strong></p>
                        <ul>
                            {group.members.map((member, index) => (
                                <li key={index} className={styles.listItem}>
                                    {member.user.name}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </li>
        </div>
    );
};

export default Group;
