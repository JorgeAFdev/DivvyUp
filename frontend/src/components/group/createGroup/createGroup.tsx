import { useState } from "react";
import { MdAddCircleOutline } from "react-icons/md";
import GroupForm from "../groupForm/groupForm";
import Fab from "../../fab/fab";
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
            <Fab icon={MdAddCircleOutline} label="Create group" onClick={openModal} id="create-group-btn" data-type="add" />
            {isModalOpen && <Modal><GroupForm title='Create group' onClose={closeModal} onSubmit={handleCreateGroup} isPending={createGroup.isPending} /></Modal>}
        </div>
    )
}

export default CreateGroup;
