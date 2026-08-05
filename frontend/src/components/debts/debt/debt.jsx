import { Button } from '@mui/material';
import styles from './debt.module.css'
import { toast } from 'react-toastify';
import { useConfirmationToast } from '../../../hooks/useConfirmationToast';
import { useSettleDebt } from '../../../hooks/usePayments';

const Debt = ({ debt, groupId }) => {
    const { showConfirmationToast } = useConfirmationToast();
    const settleDebt = useSettleDebt(groupId);

    const handlePayDebt = async () => {
        showConfirmationToast({
            message: `Are you sure you want to mark this debt as paid?`,
            onConfirm: confirmPayment,
        });
    };

    const confirmPayment = () => {
        settleDebt.mutate(debt._id, {
            onSuccess: () => {
                toast.success('Debt marked as paid');
            },
            onError: (error) => {
                toast.error(error.response?.data?.error || 'Something went wrong');
            },
        });
    };

    return (
        <li className={styles.debt}>
            <p>{debt.from.name} owes <strong>{debt.amount}€</strong> to {debt.to.name}</p>
            <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handlePayDebt}
                disabled={settleDebt.isPending}
                sx={{ backgroundColor: "primary.dark", borderRadius: "8px", textTransform: "none", fontWeight: "bold", "&:hover": { backgroundColor: "primary.main" } }}
            >
                Mark as paid
            </Button>
        </li>
    )
}

export default Debt;
