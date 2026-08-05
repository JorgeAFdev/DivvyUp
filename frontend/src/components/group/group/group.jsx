import { useState } from 'react';
import styles from './group.module.css'
import { toast } from 'react-toastify';
import GroupActions from '../groupActions/groupActions';
import { useNavigate } from 'react-router-dom';
import { useConfirmationToast } from '../../../hooks/useConfirmationToast';
import { useDeleteGroup, useUpdateGroup } from '../../../hooks/useGroups';
import { Tooltip } from 'react-tooltip';
import { getUserSession } from '../../../utils/localStorage';
import MemberAvatar from '../../avatar/memberAvatar';

const Group = ({ group }) => {
    const [isEditing, setIsEditing] = useState(false);

    const navigate = useNavigate();
    const { showConfirmationToast } = useConfirmationToast();

    const updateGroup = useUpdateGroup(group._id);
    const deleteGroup = useDeleteGroup(group._id);

    const myMemberId = group.members.find((m) => m.user?._id === getUserSession()?.id)?._id;

    const handleActionsClick = (e) => {
        e.stopPropagation();
    }

    const handleEditGroup = (data) => {
        updateGroup.mutate(data, {
            onSuccess: () => {
                setIsEditing(false);
                toast.success('Group successfully edited');
            },
            onError: (error) => {
                toast.error(error.response?.data?.error || 'there was an error editing the group');
            },
        });
    }

    const handleDeleteExpense = async () => {
        showConfirmationToast({
            message: `Are you sure you want to delete this group?`,
            onConfirm: onDelete,
        });
    };

    const onDelete = () => {
        deleteGroup.mutate(undefined, {
            onSuccess: () => {
                toast.success('Group succesfully deleted');
            },
            onError: (error) => {
                toast.error(error.response?.data?.error || 'there was an error deleting the group');
            },
        });
    };
    return (
        <li className={styles.group} id={`group-card-${group._id}`} onClick={() => navigate(`/groups/${group._id}/expenses`)}>
            <div className={styles.row} >
                <div className={styles.left}>
                    <div className={styles.info}>
                        <p><strong>{group.name}</strong></p>
                        <p>{group.description}</p>
                    </div>
                    <div className={styles.avatar}>
                        {group.members.map((member) => (
                            <div key={member._id}>
                                <MemberAvatar
                                    name={member.name}
                                    src={member.user?.profilePicture}
                                    data-tooltip-id={member._id}
                                />
                                <Tooltip id={member._id} content={member.user ? member.name : `${member.name} · no account yet`} />
                            </div>
                        ))}
                    </div>
                </div>
                <div className={styles.right} onClick={handleActionsClick}>
                    <GroupActions
                        group={group}
                        myMemberId={myMemberId}
                        editGroup={handleEditGroup}
                        onDelete={handleDeleteExpense}
                        isEditing={isEditing}
                        setIsEditing={setIsEditing}
                    />
                </div>
            </div>
        </li>
    );
};

export default Group;
