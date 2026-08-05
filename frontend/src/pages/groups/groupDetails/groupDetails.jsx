import { useEffect } from 'react';
import { toast } from 'react-toastify';
import { useGroupDetails } from '../../../hooks/useGroupDetails';
import { useNavigate, useParams } from 'react-router-dom';
import styles from "./groupDetails.module.css"
import ExpenseList from '../../../components/expense/expenseList/expenseList';
import CreateExpense from '../../../components/expense/createExpense/createExpense';
import BalanceList from '../../../components/balance/balanceList/balanceList';
import DebtsList from '../../../components/debts/debtsList';


const GroupDetails = () => {
    const navigate = useNavigate();

    const { groupId } = useParams();

    const { data, isLoading, isError, error } = useGroupDetails(groupId);

    useEffect(() => {
        if (isError) {
            toast.error(error.response?.data?.error || 'Could not load group');
            navigate('/groups');
        }
    }, [isError, error, navigate]);

    if (isLoading) {
        return <div className={styles.text}>Loading group details...</div>;
    }

    if (isError) {
        return <div className={styles.text}>Error loading data: {error.response?.data?.error || error}</div>;
    }

    return (
        <div>
            <BalanceList groupBalance={data.balance} />
            <div className={styles.grid}>
                <ExpenseList groupExpenses={data.expenses} groupId={groupId} groupMembers={data.members} />
                <DebtsList groupDebts={data.debts} groupId={groupId} />
            </div>
            <CreateExpense groupMembers={data.members} />
        </div>
    );
};

export default GroupDetails;
