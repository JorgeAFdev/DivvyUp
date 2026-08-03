import styles from "./balance.module.css"

const Balance = ({ balance }) => {
    return (
        <>
            <div className={styles.card}>
                <div className={styles.name}>
                    <p>{balance?.member?.name}</p>
                </div>
                <span className={styles.dashed}></span>
                <div className={styles.amount}>
                    {balance.amount < 0 ? <p>{balance?.amount}€</p> : <p>+{balance?.amount}€</p>}
                </div>
            </div>
        </>
    )
}

export default Balance;