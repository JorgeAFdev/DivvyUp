import Button from '../../button/button';
import { Vignette, VignetteLabel } from './vignette';
import styles from './vignettes.module.css';

const BALANCES = [
    { name: 'javier', amount: '+645' },
    { name: 'alex', amount: '-370' },
    { name: 'marta', amount: '-275' },
];

const BalancesVignette = () => (
    <Vignette>
        <VignetteLabel>Balance</VignetteLabel>
        <ul className={styles.chips}>
            {BALANCES.map(({ name, amount }) => (
                <li className={styles.chip} key={name}>
                    <span>{name}</span>
                    <span className={styles.chipRule} />
                    <span className={styles.chipAmount}>{amount}€</span>
                </li>
            ))}
        </ul>

        <VignetteLabel>Debts</VignetteLabel>
        <div className={styles.debt}>
            <p>alex owes <strong>370€</strong> to javier</p>
            {/* Decorative, so its one focusable child leaves the tab order or
                it becomes a stop nothing announces. */}
            <Button size="sm" tabIndex={-1}>Mark as paid</Button>
        </div>
    </Vignette>
);

export default BalancesVignette;
