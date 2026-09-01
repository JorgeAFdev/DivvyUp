import type { HydratedBalanceEntry } from '@monorepo/shared';
import { formatAmount } from '../../../utils/money';
import styles from "./balance.module.css"

const Balance = ({ balance }: { balance: HydratedBalanceEntry }) => {
    const sign = balance.amount > 0 ? '+' : '';

    return (
        <li className={styles.card}>
            <div className={styles.name}>
                <p>{balance?.member?.name}</p>
            </div>
            <span className={styles.dashed}></span>
            <div className={styles.amount}>
                <p>{sign}{formatAmount(balance.amount)}€</p>
            </div>
        </li>
    )
}

export default Balance;
