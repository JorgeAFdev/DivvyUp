import { useState, type Dispatch, type MouseEvent, type SetStateAction } from 'react';
import type { Group } from '@monorepo/shared';
import Modal from '../../modal/modal';
import GroupForm from '../groupForm/groupForm';
import Icon from '../../icon/icon';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import AppMenu from '../../menu/appMenu';
import { toast } from 'react-toastify';
import { useConfirmationToast } from '../../../hooks/useConfirmationToast';
import { useRegenerateInviteCode } from '../../../hooks/useGroups';
import type { GroupInput } from '../../../utils/groupApi';
import { inviteLinkFor } from '../../../utils/members';
import { apiErrorMessage } from '../../../utils/apiError';

interface GroupActionsProps {
    group: Group;
    myMemberId?: string;
    editGroup: (data: GroupInput) => void;
    isEditing: boolean;
    setIsEditing: Dispatch<SetStateAction<boolean>>;
    onDelete: () => void;
}

const GroupActions = ({ group, myMemberId, editGroup, isEditing, setIsEditing, onDelete }: GroupActionsProps) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const { showConfirmationToast } = useConfirmationToast();
    const regenerateInviteCode = useRegenerateInviteCode(group._id);

    const menuItemStyle = { gap: '5px' };

    const shareInviteLink = async () => {
        const url = inviteLinkFor(group.inviteCode);

        if (navigator.share) {
            try {
                await navigator.share({ title: group.name, text: `Join ${group.name} on DivvyUp`, url });
                return;
            } catch (error) {
                if (error instanceof Error && error.name === 'AbortError') { return; }
            }
        }

        try {
            await navigator.clipboard.writeText(url);
            toast.success('Invite link copied');
        } catch {
            toast.info(url, { autoClose: false });
        }
    };

    const resetInviteLink = () => {
        showConfirmationToast({
            message: 'Anyone holding the current link will no longer be able to join. Continue?',
            onConfirm: () => {
                regenerateInviteCode.mutate(undefined, {
                    onSuccess: () => {
                        toast.success('New invite link ready to share');
                    },
                    onError: (error) => {
                        toast.error(apiErrorMessage(error, 'there was an error resetting the link'));
                    },
                });
            },
        });
    };

    return (
        <>
            <Button sx={{ color: 'text.primary', minWidth: '0px' }} id="basic-button" aria-controls={open ? 'basic-menu' : undefined} aria-haspopup="true" aria-expanded={open ? 'true' : undefined} onClick={handleClick}>
                <Icon variant='dots' className='dots' />
            </Button>
            <AppMenu id="basic-menu" anchorEl={anchorEl} open={open} onClose={handleClose} MenuListProps={{ 'aria-labelledby': 'basic-button', }}>
                <MenuItem sx={menuItemStyle} onClick={() => { setIsEditing(true); handleClose(); }}>
                    <Icon variant='edit' />
                    Edit group
                </MenuItem>
                <MenuItem sx={menuItemStyle} id="share-invite-link" onClick={() => { shareInviteLink(); handleClose(); }}>
                    <Icon variant='share' />
                    Share invite link
                </MenuItem>
                <MenuItem sx={menuItemStyle} id="reset-invite-link" onClick={() => { resetInviteLink(); handleClose(); }}>
                    <Icon variant='refresh' />
                    Reset invite link
                </MenuItem>
                <MenuItem sx={menuItemStyle} onClick={() => { onDelete(); handleClose(); }}>
                    <Icon variant='delete' id="deleteGroup" />
                    Delete group
                </MenuItem>
            </AppMenu>
            {isEditing && (
                <Modal>
                    <GroupForm
                        title='Edit group'
                        onClose={() => setIsEditing(false)}
                        onSubmit={editGroup}
                        groupMembers={group.members}
                        lockedMemberId={myMemberId}
                        defaultValues={group}
                    />
                </Modal>
            )}
        </>
    )
}

export default GroupActions;
