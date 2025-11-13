import { useState } from 'react';
import styles from './group.module.css'
import { deleteGroup, updateGroup } from '../../../utils/groupApi';
import { toast } from 'react-toastify';
import GroupActions from '../groupActions/groupActions';
import { useAuth } from '../../../context/userContextAuth';
import { useNavigate } from 'react-router-dom';
import { useConfirmationToast } from '../../../hooks/useConfirmationToast';
import { Avatar } from '@mui/material';
import { Tooltip } from 'react-tooltip';

const Group = ({ group, setGroups }) => {
    const [isEditing, setIsEditing] = useState(false);

    const navigate = useNavigate();
    const { token } = useAuth();
    const { showConfirmationToast } = useConfirmationToast();

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
            toast.error(error.response.data.error || 'there was an error editing the group');
        }
    }

    const handleDeleteExpense = async () => {
        showConfirmationToast({
            message: `Are you sure you want to delete this group?`,
            onConfirm: onDelete,
        });
    };

    const onDelete = async () => {
        try {
            await deleteGroup(group._id, token);
            setGroups((prevGroups) => prevGroups.filter((g) => g._id !== group._id));
            toast.success('Group succesfully deleted')
        } catch (error) {
            toast.error(error.response.data.error || 'there was an error deleting the group');
        }
    };
    return (
        <div className={styles.group} id={`group-card-${group._id}`} onClick={() => navigate(`/groups/${group._id}/expenses`)}>
            <li className={styles.listItem}>
                <div className={styles.row} >
                    <div className={styles.left}>
                        <div className={styles.info}>
                            <p><strong>{group.name}</strong></p>
                            <p>{group.description}</p>
                        </div>
                        <div className={styles.avatar}>
                            {group.members.map(({ user }) => (
                                <div key={user._id}>
                                    <Avatar src={user.profilePicture} data-tooltip-id={user._id} sx={{ backgroundColor: 'white' }} />
                                    <Tooltip id={user._id} content={user.name} />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className={styles.right} onClick={handleActionsClick}>
                        <GroupActions group={group} groupMembers={groupMembers} editGroup={handleEditGroup} onDelete={handleDeleteExpense} isEditing={isEditing} setIsEditing={setIsEditing} />
                    </div>
                </div>
            </li>
        </div>
    );
};

export default Group;
