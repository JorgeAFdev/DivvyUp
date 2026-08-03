import { useState } from "react";
import { createGroup } from "../../../utils/groupApi";
import GroupForm from "../groupForm/groupForm";
import Icon from "../../icon/icon";
import Modal from "../../modal/modal";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/userContextAuth";


const CreateGroup = ({ setGroups }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const { token } = useAuth();

    const handleCreateGroup = async (data) => {
        try {
            const newGroup = await createGroup(data, token);
            setGroups((prevGroups) => [...prevGroups, newGroup])
            closeModal();
            toast.success('Group succesfully created')
        } catch (error) {
            toast.error(error.response?.data?.error || 'there was an error creating the group')
        }
    }

    return (
        <div>
            <Icon className={'add'} handleClick={openModal} id='create-group-btn' />
            {isModalOpen && <Modal><GroupForm title='Create group' onClose={closeModal} onSubmit={handleCreateGroup} /></Modal>}
        </div>
    )
}

export default CreateGroup;
