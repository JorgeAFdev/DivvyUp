import styles from './debtsList.module.css'
import Debt from "./debt/debt";

const DebtsList = ({ groupDebts, refreshGroupDetails }) => {
    return (
        <div className={styles.debtsList}>
            <div>
                {groupDebts?.length === 0 ? '' : (
                    <>
                        <h2 className={styles.title}>Debts</h2>
                        <ul className={styles.list}>
                            {groupDebts?.map((debt) => (
                                <Debt key={debt._id} debt={debt} refreshGroupDetails={refreshGroupDetails} />
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    )
}

export default DebtsList;