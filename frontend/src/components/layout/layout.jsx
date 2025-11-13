import { Link, Outlet } from 'react-router-dom';
import Header from '../header/header';
import styles from './layout.module.css';
import { Slide, ToastContainer } from 'react-toastify';

const Layout = () => {

    return (
        <div className={styles.app}>
            <Header />
            <main className={styles.main}>
                <Outlet />
                <ToastContainer
                    position="top-right"
                    autoClose={3000}
                    hideProgressBar={false}
                    closeOnClick={false}
                    pauseOnHover={true}
                    draggable
                    progress={undefined}
                    theme="dark"
                    transition={Slide}
                />
            </main>
        </div>
    );
};

export default Layout;