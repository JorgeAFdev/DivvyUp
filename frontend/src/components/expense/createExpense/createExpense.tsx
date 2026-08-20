import { useState } from "react";
import type { Member } from "@monorepo/shared";
import { MdAddCircleOutline } from "react-icons/md";
import Modal from "../../modal/modal";
import Fab from "../../fab/fab";
import { useParams } from "react-router-dom";
import ExpenseForm from "../expenseForm/expenseForm";
import { toast } from "react-toastify";
import { useCreateExpense } from "../../../hooks/useExpenses";
import type { ExpenseInput } from "../../../utils/expenseApi";
import { apiErrorMessage } from "../../../utils/apiError";

const CreateExpense = ({ groupMembers }: { groupMembers: Member[] }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    const { groupId = '' } = useParams();
    const createExpense = useCreateExpense(groupId);

    const handleCreateExpense = (data: ExpenseInput) => {
        createExpense.mutate(data, {
            onSuccess: () => {
                closeModal();
                toast.success("Expense successfully created");
            },
            onError: (error) => {
                toast.error(apiErrorMessage(error, 'there was an error creating the expense'));
            },
        });
    }

    return (
        <div>
            <Fab icon={MdAddCircleOutline} label="Create expense" onClick={openModal} data-type="add" />
            {isModalOpen && <Modal><ExpenseForm title='Create Expense' onClose={closeModal} onSubmit={handleCreateExpense} groupMembers={groupMembers} isPending={createExpense.isPending} /></Modal>}
        </div>
    )
}

export default CreateExpense;
