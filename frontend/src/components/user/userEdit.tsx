import { useState } from "react";
import type { SessionUser } from "@monorepo/shared";
import Modal from "../modal/modal";
import UserEditForm from "./userEditForm";
import styles from "./userEditForm.module.css";

const UserEdit = ({ user }: { user: SessionUser }) => {
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
