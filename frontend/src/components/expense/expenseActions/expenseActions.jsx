import { useState } from 'react';
import Modal from '../../modal/modal';
import ExpenseForm from '../expenseForm/expenseForm';
import Icon from '../../icon/icon';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import AppMenu from '../../menu/appMenu';

const ExpenseActions = ({ groupMembers, handleEditExpense, isEditing, setIsEditing, onDelete, defaultValues }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const menuItemStyle = { gap: '5px' };

    return (
        <>
            <Button sx={{ color: 'text.primary', minWidth: '0px' }} id="basic-button" aria-controls={open ? 'basic-menu' : undefined} aria-haspopup="true" aria-expanded={open ? 'true' : undefined} onClick={handleClick}>
                <Icon variant='dots' className='dots' />
            </Button>
            <AppMenu id="basic-menu" anchorEl={anchorEl} open={open} onClose={handleClose} MenuListProps={{ 'aria-labelledby': 'basic-button', }}>
                <MenuItem sx={menuItemStyle} onClick={() => { setIsEditing(true); handleClose(); }}>
                    <Icon variant='edit' />
                    Edit expense
                </MenuItem>
                <MenuItem sx={menuItemStyle} onClick={() => { onDelete(); handleClose(); }}>
                    <Icon variant='delete' id="deleteGroup" />
                    Delete expense
                </MenuItem>
            </AppMenu>
            {isEditing && <Modal><ExpenseForm title='Edit Expense' onClose={() => setIsEditing(false)} onSubmit={handleEditExpense} groupMembers={groupMembers} defaultValues={defaultValues} /></Modal>}
        </>
    )
}

export default ExpenseActions;