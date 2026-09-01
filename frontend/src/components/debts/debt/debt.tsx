import Button from '../../button/button';
import type { HydratedPayment } from '@monorepo/shared';
import styles from './debt.module.css'
import { toast } from 'react-toastify';
import { useConfirmationToast } from '../../../hooks/useConfirmationToast';
import { useSettleDebt } from '../../../hooks/usePayments';
import { apiErrorMessage } from '../../../utils/apiError';
import { formatAmount } from '../../../utils/money';

const Debt = ({ debt, groupId }: { debt: HydratedPayment; groupId: string }) => {
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
                toast.error(apiErrorMessage(error, 'Something went wrong'));
            },
        });
    };

    return (
        <li className={styles.debt}>
            <p>{debt.from?.name} owes <strong>{formatAmount(debt.amount)}€</strong> to {debt.to?.name}</p>
            <Button size="sm" onClick={handlePayDebt} loading={settleDebt.isPending}>
                Mark as paid
            </Button>
        </li>
    )
}

export default Debt;
