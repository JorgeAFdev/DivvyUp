import { useState } from 'react';
import styles from './expense.module.css'
import { toast } from 'react-toastify';
import ExpenseActions from '../expenseActions/expenseActions';
import { useConfirmationToast } from '../../../hooks/useConfirmationToast';
import { useDeleteExpense, useUpdateExpense } from '../../../hooks/useExpenses';
import { Tooltip } from 'react-tooltip';
import MemberAvatar from '../../avatar/memberAvatar';

const Expense = ({ expense, groupId, groupMembers }) => {
    const [isEditing, setIsEditing] = useState(false);

    const { showConfirmationToast } = useConfirmationToast();

    const updateExpense = useUpdateExpense(groupId, expense._id);
    const deleteExpense = useDeleteExpense(groupId, expense._id);

    const handleEditExpense = (data) => {
        updateExpense.mutate(data, {
            onSuccess: () => {
                setIsEditing(false);
                toast.success('Expense succesfully edited');
            },
            onError: (error) => {
                toast.error(error.response?.data?.error || 'there was an error editing the expense');
            },
        });
    }

    const handleDeleteExpense = async () => {
        showConfirmationToast({
            message: `Are you sure you want to delete this expense?`,
            onConfirm: onDelete,
        });
    };

    const onDelete = () => {
        deleteExpense.mutate(undefined, {
            onSuccess: () => {
                toast.success('Expense succesfully deleted');
            },
            onError: (error) => {
                toast.error(error.response?.data?.error || 'there was an error deleting the expense');
            },
        });
    };

    return (
        <li className={styles.expense}>
            <div className={styles.row}>
                <div className={styles.left}>
                    <p><strong>{expense.description}</strong></p>
                    <div className={styles.paidBy}>
                        <p>Paid by</p>
                        <MemberAvatar
                            name={expense.paidBy.name}
                            src={expense.paidBy.user?.profilePicture}
                            data-tooltip-id={expense.paidBy._id}
                        />
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
    );
};

export default Expense;
