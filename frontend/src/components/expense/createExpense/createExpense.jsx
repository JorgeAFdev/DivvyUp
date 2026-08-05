import { useState } from "react";
import Modal from "../../modal/modal";
import Icon from "../../icon/icon"
import { useParams } from "react-router-dom";
import ExpenseForm from "../expenseForm/expenseForm";
import { toast } from "react-toastify";
import { useCreateExpense } from "../../../hooks/useExpenses";

const CreateExpense = ({ groupMembers }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const { groupId } = useParams();
    const createExpense = useCreateExpense(groupId);

    const handleCreateExpense = (data) => {
        createExpense.mutate(data, {
            onSuccess: () => {
                closeModal();
                toast.success("Expense successfully created");
            },
            onError: (error) => {
                toast.error(error.response?.data?.error || 'there was an error creating the expense');
            },
        });
    }

    return (
        <div>
            <Icon className={'add'} handleClick={openModal} />
            {isModalOpen && <Modal><ExpenseForm title='Create Expense' onClose={closeModal} onSubmit={handleCreateExpense} groupMembers={groupMembers} /></Modal>}
        </div>
    )
}

export default CreateExpense;
