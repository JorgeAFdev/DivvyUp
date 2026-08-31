import { MdOutlineNotificationsActive } from 'react-icons/md';
import Icon from '../../icon/icon';
import { Vignette } from './vignette';
import styles from './vignettes.module.css';

// The real wording the backend emits, not invented copy.
const TOASTS = [
    'alex has settled their debt with javier',
    'you have been added to expense Dinner from group Lisbon',
];

const NotificationsVignette = () => (
    <Vignette>
        {TOASTS.map((message, index) => (
            <div
                className={`${styles.toast} ${index > 0 ? styles.toastStacked : ''}`.trim()}
                key={message}
            >
                <Icon icon={MdOutlineNotificationsActive} size={20} className={styles.toastIcon} />
                <div>
                    <p className={styles.toastTitle}>DivvyUp</p>
                    <p className={styles.toastBody}>{message}</p>
                </div>
            </div>
        ))}
    </Vignette>
);

export default NotificationsVignette;
