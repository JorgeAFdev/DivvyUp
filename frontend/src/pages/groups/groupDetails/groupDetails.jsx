import { useQuery, useQueryClient } from 'react-query';
import { useAuth } from '../../../context/userContextAuth';
import { getGroupDetails } from '../../../utils/groupApi';
import { useNavigate, useParams } from 'react-router-dom';
import styles from "./groupDetails.module.css"
import ExpenseList from '../../../components/expense/expenseList/expenseList';
import CreateExpense from '../../../components/expense/createExpense/createExpense';
import BalanceList from '../../../components/balance/balanceList/balanceList';
import DebtsList from '../../../components/debts/debtsList';
import { useDarkMode } from '../../../context/darkModeContext';


const GroupDetails = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { groupId } = useParams();
    const { token } = useAuth();
    const { darkMode } = useDarkMode();

    const { data, isLoading, isError, error } = useQuery(['groupDetails', groupId], () => getGroupDetails(groupId, token), {
        onError: (error) => {
            navigate('/groups')
        },
    });

    if (isLoading) {
        return <div className={darkMode ? styles.text : ''}>Loading group details...</div>;
    }

    if (isError) {
        return <div className={darkMode ? styles.text : ''}>Error loading data: {error.response?.data?.error || error}</div>;
    }

    const refreshGroupDetails = () => {
        queryClient.invalidateQueries(['groupDetails', groupId]);
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
