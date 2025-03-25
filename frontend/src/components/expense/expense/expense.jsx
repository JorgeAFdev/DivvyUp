import { useState } from 'react';
import styles from './expense.module.css'
import { deleteGroupExpense, updateGroupExpense } from '../../../utils/expenseApi';
import { toast } from 'react-toastify';
import ExpenseActions from '../expenseActions/expenseActions';
import { useDarkMode } from '../../../context/darkModeContext';
import { useAuth } from '../../../context/userContextAuth';
import { Avatar } from '@mui/material';
import { useConfirmationToast } from '../../../hooks/useConfirmationToast';

const Expense = ({ expense, refreshGroupDetails }) => {
    const [expandedExpenseId, setExpandedExpenseId] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    const { darkMode } = useDarkMode();
    const { token } = useAuth();
    const { showConfirmationToast } = useConfirmationToast();

    const groupMembers = expense.group.members.map((member) => member.user);

    const toggleParticipants = (expenseId) => {
        setExpandedExpenseId(expandedExpenseId === expenseId || isEditing ? null : expenseId);
    };

    const handleEditExpense = async (data) => {
        try {
            const response = await updateGroupExpense(expense.group._id, expense._id, data, token);
            setIsEditing(false);
            refreshGroupDetails();
            toast.success('Expense succesfully edited');
        } catch (error) {
            toast.error(error.response.data.error || 'there was an error editing the expense');
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
            await deleteGroupExpense(expense.group._id, expense._id, token);
            refreshGroupDetails();
            toast.success('Expense succesfully deleted');
        } catch (error) {
            toast.error(error.response.data.error || 'there was an error deleting the expense');
        }
    };

    return (
        <div className={`${styles.expense} ${darkMode ? styles.expenseDark : ''}`}>
            <li className={styles.listItem} onClick={() => toggleParticipants(expense._id)} title='click to see the details'>
                <div className={styles.row}>
                    <div className={styles.left}>
                        <p><strong>{expense.description}</strong></p>
                        <div className={styles.paidBy} title={expense.paidBy.name}>
                            <p>Paid by</p>
                            <Avatar src={expense.paidBy.profilePicture} alt="" />
                        </div>
                    </div>
                    <div className={styles.right}>
                        <p><strong>{expense.totalAmount}€</strong></p>
                        <div className={styles.actions}>
                            <ExpenseActions groupMembers={groupMembers} handleEditExpense={handleEditExpense} onDelete={handleDeleteExpense} isEditing={isEditing} setIsEditing={setIsEditing} defaultValues={expense} />
                        </div>
                    </div>
                </div>
                {expandedExpenseId === expense._id && (
                    <div className={styles.participants}>
                        <p><strong>Participants</strong></p>
                        <ul>
                            {expense.participants.map((participant, index) => (
                                <li key={index} className={styles.listItem}>
                                    {participant.user.name} {participant.amountOwed}€
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </li>
        </div>
    );
};

export default Expense;
