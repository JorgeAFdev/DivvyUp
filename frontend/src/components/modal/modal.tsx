import type { ReactNode } from 'react';
import styles from './modal.module.css';

const Modal = ({ children }: { children: ReactNode }) => {
    return (
        <div className={styles.modal}>
            <div className={styles.content}>
                {children}
            </div>
        </div>
    );
};

export default Modal;
