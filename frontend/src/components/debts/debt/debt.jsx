import { Button } from '@mui/material';
import { useDarkMode } from '../../../context/darkModeContext';
import styles from './debt.module.css'
import { useAuth } from '../../../context/userContextAuth';
import { updatePayment } from '../../../utils/paymentApi';
import { toast } from 'react-toastify';
import { useConfirmationToast } from '../../../hooks/useConfirmationToast';
const Debt = ({ debt, refreshGroupDetails }) => {
    const { darkMode } = useDarkMode();
    const { token } = useAuth();
    const { showConfirmationToast } = useConfirmationToast();

    const handlePayDebt = async () => {
        showConfirmationToast({
            message: `Are you sure you want to mark this debt as paid?`,
            onConfirm: confirmPayment,
        });
    };

    const confirmPayment = async () => {
        try {
            await updatePayment(debt._id, token);
            toast.success('Debt marked as paid');
            refreshGroupDetails();
        } catch (error) {
            toast.error(error.response.data.error || 'Something went wrong');
        }
    };

    return (
        <>
            <div className={`${styles.debt} ${darkMode ? styles.debtDark : ''}`}>
                <p>{debt.from.name} owes <strong>{debt.amount}€</strong> to {debt.to.name}</p>
                <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={handlePayDebt}
                    sx={{ background: "#3c8ccd", borderRadius: "8px", textTransform: "none", fontWeight: "bold", "&:hover": { background: "#1e90ff" } }}
                >
                    Mark as paid
                </Button>
            </div >
        </>
    )
}

export default Debt;