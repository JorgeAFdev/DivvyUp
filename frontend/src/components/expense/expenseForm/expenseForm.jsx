import React from "react";
import { useForm } from "react-hook-form";
import styles from "./expenseform.module.css";
import { IoCloseOutline } from "react-icons/io5";
import { useDarkMode } from "../../../context/darkModeContext";

const ExpenseForm = ({ onClose, onSubmit, title, defaultValues = {}, groupMembers }) => {
    const { darkMode } = useDarkMode();
    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm({
        defaultValues: {
            description: defaultValues.description,
            totalAmount: defaultValues.totalAmount,
            paidBy: defaultValues?.paidBy?._id,
            participants: defaultValues?.participants,
        }
    });

    const paidBy = watch("paidBy");

    const handleFormSubmit = (data) => {
        onSubmit(data);
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className={`${styles.form} ${darkMode ? styles.formDark : ''}`}>
            <div className={styles.top}>
                <h2>{title}</h2>
                <IoCloseOutline className={styles.btn} onClick={onClose} />
            </div>

            <div className={styles.formFields}>
                <div className={styles.formField}>
                    <label htmlFor="description" className={styles.label}>Description</label>
                    <input
                        id="description"
                        type="text"
                        placeholder="Flights to madrid"
                        autoFocus
                        {...register("description", {
                            required: "Description is required",
                            maxLength: { value: 30, message: 'description is to large' },
                        })}
                        className={`${styles.input} ${errors.description ? styles.errorInput : ""} ${darkMode ? styles.inputDark : ''}`}
                    />
                    {errors.description && (
                        <span className={styles.errorText}>{errors.description.message}</span>
                    )}
                </div>

                <div className={styles.formField}>
                    <label htmlFor="totalAmount" className={styles.label}>Total Amount</label>
                    <input
                        id="totalAmount"
                        type="text"
                        placeholder="20.50"
                        {...register("totalAmount", {
                            required: "Total amount is required",
                            min: { value: 0.01, message: "Amount must be greater than 0" },
                            max: { value: 999999, message: "Amount must be less than 1000000" },
                            pattern: {
                                value: /^(?:\d+|\d*\.\d{1,2})$/,
                                message: "Enter a valid amount (e.g., 20 or 75.40)",
                            },
                        })}
                        className={`${styles.input} ${errors.totalAmount ? styles.errorInput : ""} ${darkMode ? styles.inputDark : ''}`}
                    />
                    {errors.totalAmount && (
                        <span className={styles.errorText}>{errors.totalAmount.message}</span>
                    )}
                </div>

                <div className={styles.payer}>
                    <label htmlFor="select-payer" className={styles.label}>Paid By</label>
                    <select
                        {...register("paidBy", { required: "Please select a payer" })}
                        id="select-payer"
                        defaultValue=""
                        className={`${styles.select} ${darkMode ? styles.selectDark : ''}`}
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
                                defaultChecked={defaultValues.participants ? defaultValues.participants.some((p) => p.user._id === member._id) : true}
                                value={member._id}
                                id={`participant-${member._id}`}
                                {...register('participants', { required: 'At least one participant must be selected' })} />
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
                <button type="submit" className={styles.submitButton}>
                    {title}
                </button>
            </div>
        </form>
    );
};

export default ExpenseForm;
