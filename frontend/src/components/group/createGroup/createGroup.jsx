import { useEffect, useState } from "react";
import { createGroup } from "../../../utils/groupApi";
import GroupForm from "../groupForm/groupForm";
import Icon from "../../icon/icon";
import Modal from "../../modal/modal";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/userContextAuth";
import { getUserSession } from "../../../utils/localStorage";
import { useNavigate } from "react-router-dom";


const CreateGroup = ({ setGroups }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const { token, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (token) {
            const session = getUserSession();
            const email = session?.email;
            if (!email) {
                logout();
                navigate('/login');
            }
        }
    }, [token, logout, navigate]);

    const handleCreateGroup = async (data) => {
        try {
            const groupData = {
                ...data,
                ...data.members.push({ email })
            }
            const newGroup = await createGroup(groupData, token);
            setGroups((prevGroups) => [...prevGroups, newGroup])
            closeModal();
            toast.success('Group succesfully created')
        } catch (error) {
            toast.error(error.response.data.error || 'there was an error creating the group')
        }
    }

    return (
        <div>
            <Icon className={'add'} handleClick={openModal} id='create-group-btn' />
            {isModalOpen && <Modal><GroupForm title='Create group' onClose={closeModal} onSubmit={handleCreateGroup} createdBy={email} /></Modal>}
        </div>
    )
}

export default CreateGroup;