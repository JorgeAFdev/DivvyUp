import { useState, type Dispatch, type MouseEvent, type SetStateAction } from 'react';
import type { HydratedExpense, Member } from '@monorepo/shared';
import Modal from '../../modal/modal';
import ExpenseForm from '../expenseForm/expenseForm';
import { MdEdit } from 'react-icons/md';
import { FaTrashAlt } from 'react-icons/fa';
import { TbDotsVertical } from 'react-icons/tb';
import Icon from '../../icon/icon';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import AppMenu from '../../menu/appMenu';
import type { ExpenseInput } from '../../../utils/expenseApi';

interface ExpenseActionsProps {
    groupMembers: Member[];
    handleEditExpense: (data: ExpenseInput) => void;
    editPending?: boolean;
    isEditing: boolean;
    setIsEditing: Dispatch<SetStateAction<boolean>>;
    onDelete: () => void;
    defaultValues?: HydratedExpense;
}

const ExpenseActions = ({ groupMembers, handleEditExpense, editPending, isEditing, setIsEditing, onDelete, defaultValues }: ExpenseActionsProps) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const menuItemStyle = { gap: '5px' };

    return (
        <>
            <IconButton aria-label="Expense actions" sx={{ color: 'text.primary' }} id="basic-button" aria-controls={open ? 'basic-menu' : undefined} aria-haspopup="true" aria-expanded={open ? 'true' : undefined} onClick={handleClick}>
                <Icon icon={TbDotsVertical} size={20} data-type="dots" />
            </IconButton>
            <AppMenu id="basic-menu" anchorEl={anchorEl} open={open} onClose={handleClose} MenuListProps={{ 'aria-labelledby': 'basic-button', }}>
                <MenuItem sx={menuItemStyle} onClick={() => { setIsEditing(true); handleClose(); }}>
                    <Icon icon={MdEdit} />
                    Edit expense
                </MenuItem>
                <MenuItem sx={menuItemStyle} onClick={() => { onDelete(); handleClose(); }}>
                    <Icon icon={FaTrashAlt} id="deleteGroup" />
                    Delete expense
                </MenuItem>
            </AppMenu>
            {isEditing && <Modal><ExpenseForm title='Edit Expense' onClose={() => setIsEditing(false)} onSubmit={handleEditExpense} groupMembers={groupMembers} defaultValues={defaultValues} isPending={editPending} /></Modal>}
        </>
    )
}

export default ExpenseActions;
