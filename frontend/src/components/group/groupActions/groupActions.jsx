import { useState } from 'react';
import Modal from '../../modal/modal';
import GroupForm from '../groupForm/groupForm';
import Icon from '../../icon/icon';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material';

const GroupActions = ({ group, groupMembers, editGroup, isEditing, setIsEditing, onDelete }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const theme = useTheme();
    const textColor = theme.palette.text.primary;
    const colorBg = theme.palette.background.color;
    const hoverBg = theme.palette.action.hover;

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
                    <Button sx={{ color: textColor, minWidth: '0px', padding: '0', textTransform: 'none', fontSize: '16px', gap: '5px' }} onClick={() => setIsEditing(true)}>
                        <Icon variant='edit' />
                        Edit group
                    </Button>
                </MenuItem>
                <MenuItem onClick={handleClose}>
                    <Button sx={{ color: textColor, minWidth: '0px', padding: '0', textTransform: 'none', fontSize: '16px', gap: '5px' }} onClick={onDelete} >
                        <Icon variant='delete' id="deleteGroup" />
                        Delete group
                    </Button>
                </MenuItem>
            </Menu>
            {isEditing && <Modal><GroupForm title='Edit group' onClose={() => setIsEditing(false)} onSubmit={editGroup} groupMembers={groupMembers} defaultValues={group} /></Modal>}
        </>
    )
}

export default GroupActions;