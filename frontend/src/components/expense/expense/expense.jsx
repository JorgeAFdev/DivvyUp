import { useState } from 'react';
import styles from './expense.module.css'
import { deleteGroupExpense, updateGroupExpense } from '../../../utils/expenseApi';
import { toast } from 'react-toastify';
import ExpenseActions from '../expenseActions/expenseActions';
import { useAuth } from '../../../context/userContextAuth';
import { Avatar } from '@mui/material';
import { useConfirmationToast } from '../../../hooks/useConfirmationToast';
import { Tooltip } from 'react-tooltip';
import { initialsOf } from '../../../utils/members';

const Expense = ({ expense, groupId, groupMembers, refreshGroupDetails }) => {
    const [isEditing, setIsEditing] = useState(false);

    const { token } = useAuth();
    const { showConfirmationToast } = useConfirmationToast();


    const handleEditExpense = async (data) => {
        try {
            const response = await updateGroupExpense(groupId, expense._id, data, token);
            setIsEditing(false);
            refreshGroupDetails();
            toast.success('Expense succesfully edited');
        } catch (error) {
            toast.error(error.response?.data?.error || 'there was an error editing the expense');
        }
    }

    const handleDeleteExpense = async () => {
        showConfirmationToast({
            message: `Are you sure you want to delete this expense?`,
            onConfirm: onDelete,
        });
    };

    const onDelete = async () => {
        try {
            await deleteGroupExpense(groupId, expense._id, token);
            refreshGroupDetails();
            toast.success('Expense succesfully deleted');
        } catch (error) {
            toast.error(error.response?.data?.error || 'there was an error deleting the expense');
        }
    };

    return (
        <div className={styles.expense}>
            <li className={styles.listItem}>
                <div className={styles.row}>
                    <div className={styles.left}>
                        <p><strong>{expense.description}</strong></p>
                        <div className={styles.paidBy}>
                            <p>Paid by</p>
                            <Avatar
                                src={expense.paidBy.user?.profilePicture}
                                alt={`Profile picture of ${expense.paidBy.name}`}
                                data-tooltip-id={expense.paidBy._id}
                                sx={{ backgroundColor: 'white', color: '#3c8ccd', fontSize: '0.9rem' }}
                            >
                                {initialsOf(expense.paidBy.name)}
                            </Avatar>
                            <Tooltip id={expense.paidBy._id} content={expense.paidBy.name} />
                        </div>
                    </div>
                    <div className={styles.right}>
                        <p><strong>{expense.totalAmount}€</strong></p>
                        <div className={styles.actions}>
                            <ExpenseActions groupMembers={groupMembers} handleEditExpense={handleEditExpense} onDelete={handleDeleteExpense} isEditing={isEditing} setIsEditing={setIsEditing} defaultValues={expense} />
                        </div>
                    </div>
                </div>
            </li>
        </div>
    );
};

export default Expense;
