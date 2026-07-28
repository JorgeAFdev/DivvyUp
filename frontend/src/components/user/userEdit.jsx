import { useState } from "react";
import Modal from "../modal/modal";
import UserEditForm from "./userEditForm";
import styles from "./userEditForm.module.css"; // Import CSS Module

const UserEdit = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button  className={styles.button}  onClick={() => setIsOpen(true) }>Edit profile </button>

            {isOpen && (
                <Modal>
                    <UserEditForm user={user} onClose={() => setIsOpen(false)} />
                </Modal>
            )}
        </>
    );
};

export default UserEdit;
