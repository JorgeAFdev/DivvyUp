import { useEffect, useState } from "react";
import Modal from "../../modal/modal";
import Icon from "../../icon/icon"
import { createGroupExpense } from "../../../utils/expenseApi";
import { getGroupById } from "../../../utils/groupApi";
import { useParams } from "react-router-dom";
import ExpenseForm from "../expenseForm/expenseForm";
import { toast } from "react-toastify";
import { useAuth } from "../../../context/userContextAuth";

const CreateExpense = ({ refreshGroupDetails }) => {
    const [groupInfo, setGroupInfo] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const { groupId } = useParams();
    const { token } = useAuth();

    useEffect(() => {
        getGroupInfo();
    }, []);

    const getGroupInfo = async () => {
        try {
            const data = await getGroupById(groupId, token);
            setGroupInfo(data);
        } catch (error) {
            console.log(error.response?.data?.error)
        }
    }
    const groupMembers = groupInfo?.members ?? [];

    const handleCreateExpense = async (data) => {
        try {
            const newExpense = await createGroupExpense(groupId, data, token);
            refreshGroupDetails();
            closeModal();
            toast.success("Expense successfully created");
        } catch (error) {
            toast.error(error.response?.data?.error || 'there was an error creating the expense');
        }
    }

    return (
        <div>
            <Icon className={'add'} handleClick={openModal} />
            {isModalOpen && <Modal><ExpenseForm title='Create Expense' onClose={closeModal} onSubmit={handleCreateExpense} groupMembers={groupMembers} /></Modal>}
        </div>
    )
}

export default CreateExpense;