import { useState } from "react";
import Modal from "../modal/modal";
import UserEditForm, { type EditableUser } from "./userEditForm";
import styles from "./userEditForm.module.css";

const UserEdit = ({ user }: { user: EditableUser }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button className={styles.button} onClick={() => setIsOpen(true)}>Edit profile </button>

            {isOpen && (
                <Modal>
                    <UserEditForm user={user} onClose={() => setIsOpen(false)} />
                </Modal>
            )}
        </>
    );
};

export default UserEdit;
