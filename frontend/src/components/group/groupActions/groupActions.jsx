import { useState } from 'react';
import Modal from '../../modal/modal';
import GroupForm from '../groupForm/groupForm';
import Icon from '../../icon/icon';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material';
import { toast } from 'react-toastify';
import { useConfirmationToast } from '../../../hooks/useConfirmationToast';
import { useRegenerateInviteCode } from '../../../hooks/useGroups';
import { inviteLinkFor } from '../../../utils/members';

const GroupActions = ({ group, myMemberId, editGroup, isEditing, setIsEditing, onDelete }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const { showConfirmationToast } = useConfirmationToast();
    const regenerateInviteCode = useRegenerateInviteCode(group._id);

    const theme = useTheme();
    const textColor = theme.palette.text.primary;
    const colorBg = theme.palette.background.color;
    const hoverBg = theme.palette.action.hover;

    const menuItemStyle = { color: textColor, minWidth: '0px', padding: '0', textTransform: 'none', fontSize: '16px', gap: '5px' };

    const shareInviteLink = async () => {
        const url = inviteLinkFor(group.inviteCode);

        if (navigator.share) {
            try {
                await navigator.share({ title: group.name, text: `Join ${group.name} on DivvyUp`, url });
                return;
            } catch (error) {
                if (error.name === 'AbortError') { return; }
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
                        toast.error(error.response?.data?.error || 'there was an error resetting the link');
                    },
                });
            },
        });
    };

    return (
        <>
            <Button sx={{ color: textColor, minWidth: '0px' }} id="basic-button" aria-controls={open ? 'basic-menu' : undefined} aria-haspopup="true" aria-expanded={open ? 'true' : undefined} onClick={handleClick}>
                <Icon variant='dots' className='dots' />
            </Button>
            <Menu sx={{
                '& .MuiPaper-root': { backgroundColor: colorBg, color: textColor }, '& .MuiMenuItem-root': {
                    transition: 'background-color 0.3s', '&:hover': { backgroundColor: hoverBg }
                }
            }} id="basic-menu" anchorEl={anchorEl} open={open} onClose={handleClose} MenuListProps={{ 'aria-labelledby': 'basic-button', }}>
                <MenuItem onClick={handleClose} >
                    <Button sx={menuItemStyle} onClick={() => setIsEditing(true)}>
                        <Icon variant='edit' />
                        Edit group
                    </Button>
                </MenuItem>
                <MenuItem onClick={handleClose}>
                    <Button sx={menuItemStyle} onClick={shareInviteLink} id="share-invite-link">
                        <Icon variant='share' />
                        Share invite link
                    </Button>
                </MenuItem>
                <MenuItem onClick={handleClose}>
                    <Button sx={menuItemStyle} onClick={resetInviteLink} id="reset-invite-link">
                        <Icon variant='refresh' />
                        Reset invite link
                    </Button>
                </MenuItem>
                <MenuItem onClick={handleClose}>
                    <Button sx={menuItemStyle} onClick={onDelete} >
                        <Icon variant='delete' id="deleteGroup" />
                        Delete group
                    </Button>
                </MenuItem>
            </Menu>
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
