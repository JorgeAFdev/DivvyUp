import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { expenseSchema } from "@monorepo/validation";
import type { HydratedExpense, Member } from "@monorepo/shared";
import type { ExpenseInput } from "../../../utils/expenseApi";
import styles from "./expenseform.module.css";
import CloseButton from "../../closeButton/closeButton";
import Button from "../../button/button";
import FormField from "../../formField/formField";

type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
    onClose: () => void;
    onSubmit: (data: ExpenseInput) => void;
    title: string;
    defaultValues?: Partial<HydratedExpense>;
    groupMembers: Member[];
    isPending?: boolean;
}

const ExpenseForm = ({ onClose, onSubmit, title, defaultValues = {}, groupMembers, isPending = false }: ExpenseFormProps) => {
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ExpenseFormValues>({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            description: defaultValues.description,
            totalAmount: defaultValues.totalAmount,
            paidBy: defaultValues.paidBy?._id,
            participants: defaultValues.participants
                ?.map((p) => p.member?._id)
                .filter((id): id is string => Boolean(id)),
        }
    });

    const handleFormSubmit = (data: ExpenseFormValues) => {
        onSubmit(data satisfies ExpenseInput);
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className={styles.form}>
            <div className={styles.top}>
                <h2>{title}</h2>
                <CloseButton onClick={onClose} />
            </div>

            <div className={styles.formFields}>
                <FormField
                    id="description"
                    label="Description"
                    type="text"
                    placeholder="Flights to madrid"
                    autoFocus
                    error={errors.description}
                    {...register("description")}
                />

                <FormField
                    id="totalAmount"
                    label="Total Amount"
                    type="text"
                    placeholder="20.50"
                    error={errors.totalAmount}
                    {...register("totalAmount", { valueAsNumber: true })}
                />

                <div className={styles.payer}>
                    <label htmlFor="select-payer" className={styles.label}>Paid By</label>
                    <select
                        {...register("paidBy")}
                        id="select-payer"
                        defaultValue=""
                        className={styles.select}
                    >
                        <option value="" disabled>--Please choose an option--</option>
                        {groupMembers.map(member => (
                            <option key={member._id} value={member._id}>
                                {member.name}
                            </option>
                        ))}
                    </select>
                    {errors.paidBy && (
                        <span className={styles.errorText}>{errors.paidBy.message}</span>
                    )}
                </div>

                <div className={styles.participants}>
                    <label className={styles.label}>Participants</label>
                    {groupMembers.map(member => (
                        <div className={styles.participant} key={member._id}>
                            <input
                                type="checkbox"
                                defaultChecked={defaultValues.participants ? defaultValues.participants.some((p) => p.member?._id === member._id) : true}
                                value={member._id}
                                id={`participant-${member._id}`}
                                {...register('participants')} />
                            <label htmlFor={`participant-${member._id}`}>
                                {member.name}
                            </label>
                        </div>
                    ))}
                    {errors.participants && (
                        <span className={styles.errorText}>{errors.participants.message}</span>
                    )}
                </div>
            </div>


            <div className={styles.submit}>
                <Button type="submit" loading={isPending}>{title}</Button>
            </div>
        </form>
    );
};

export default ExpenseForm;
