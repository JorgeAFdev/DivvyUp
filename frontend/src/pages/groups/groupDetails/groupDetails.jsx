import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/userContextAuth';
import { getGroupDetails } from '../../../utils/groupApi';
import { useNavigate, useParams } from 'react-router-dom';
import styles from "./groupDetails.module.css"
import ExpenseList from '../../../components/expense/expenseList/expenseList';
import CreateExpense from '../../../components/expense/createExpense/createExpense';
import BalanceList from '../../../components/balance/balanceList/balanceList';
import DebtsList from '../../../components/debts/debtsList';


const GroupDetails = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { groupId } = useParams();
    const { token } = useAuth();

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['groupDetails', groupId],
        queryFn: () => getGroupDetails(groupId, token),
    });

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

    const refreshGroupDetails = () => {
        queryClient.invalidateQueries({ queryKey: ['groupDetails', groupId] });
    };

    return (
        <div>
            <BalanceList groupBalance={data.balance} />
            <div className={styles.grid}>
                <ExpenseList groupExpenses={data.expenses} refreshGroupDetails={refreshGroupDetails} />
                <DebtsList groupDebts={data.debts} refreshGroupDetails={refreshGroupDetails} />
            </div>
            <CreateExpense refreshGroupDetails={refreshGroupDetails} />
        </div>
    );
};

export default GroupDetails;
