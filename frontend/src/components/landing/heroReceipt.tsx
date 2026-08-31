import styles from './heroReceipt.module.css';

const SHARES = [
    { name: 'javier', amount: '84.00' },
    { name: 'alex', amount: '84.00' },
    { name: 'marta', amount: '84.00' },
];

// Decorative: the hero's heading and copy already carry this to a screen
// reader, and a column of faux amounts read out loud would only get in the way.
const HeroReceipt = () => (
    <div className={styles.receipt} aria-hidden="true">
        <p className={styles.brand}>DivvyUp</p>
        <p className={styles.meta}>Dinner in Lisbon<br />paid by javier</p>

        <dl className={styles.rows}>
            {SHARES.map(({ name, amount }) => (
                <div className={styles.row} key={name}>
                    <dt>{name}</dt>
                    <dd>{amount}</dd>
                </div>
            ))}
        </dl>

        <div className={styles.rule} />

        <div className={`${styles.row} ${styles.total}`}>
            <span>TOTAL</span>
            <span>252.00</span>
        </div>

        <p className={styles.settle}>javier is owed 168.00</p>
    </div>
);

export default HeroReceipt;
