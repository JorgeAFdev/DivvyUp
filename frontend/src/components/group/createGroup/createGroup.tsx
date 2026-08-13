import { useState } from "react";
import GroupForm from "../groupForm/groupForm";
import Icon from "../../icon/icon";
import Modal from "../../modal/modal";
import { toast } from "react-toastify";
import { useCreateGroup } from "../../../hooks/useGroups";
import type { GroupInput } from "../../../utils/groupApi";
import { apiErrorMessage } from "../../../utils/apiError";

const CreateGroup = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const createGroup = useCreateGroup();

    const handleCreateGroup = (data: GroupInput) => {
        createGroup.mutate(data, {
            onSuccess: () => {
                closeModal();
                toast.success('Group succesfully created');
            },
            onError: (error) => {
                toast.error(apiErrorMessage(error, 'there was an error creating the group'));
            },
        });
    }

    return (
        <div>
            <Icon className={'add'} handleClick={openModal} id='create-group-btn' />
            {isModalOpen && <Modal><GroupForm title='Create group' onClose={closeModal} onSubmit={handleCreateGroup} /></Modal>}
        </div>
    )
}

export default CreateGroup;
