import { useState } from "react";
import Modal from "../modal/modal";
import UserEditForm, { type EditableUser } from "./userEditForm";
import Button from "../button/button";
import styles from "./userEditForm.module.css";

const UserEdit = ({ user }: { user: EditableUser }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <Button className={styles.fullWidth} onClick={() => setIsOpen(true)}>Edit profile</Button>

            {isOpen && (
                <Modal>
                    <UserEditForm user={user} onClose={() => setIsOpen(false)} />
                </Modal>
            )}
        </>
    );
};

export default UserEdit;
