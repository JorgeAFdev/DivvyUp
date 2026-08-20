import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { groupMemberSchema, groupSchema } from "@monorepo/validation";
import type { Member } from "@monorepo/shared";
import type { GroupInput } from "../../../utils/groupApi";
import styles from "./groupform.module.css";
import { IoCloseOutline } from "react-icons/io5";
import Button from "../../button/button";

// hasAccount is a UI-only flag (it tags a member as claimed), not part of the
// shared input contract, so it is added here as a passthrough — like the file
// field in registerForm — or the resolver would strip it from the form values.
const groupFormSchema = groupSchema.extend({
    members: z.array(groupMemberSchema.extend({ hasAccount: z.boolean().optional() })).min(1),
});

type GroupFormValues = z.infer<typeof groupFormSchema>;

interface GroupFormProps {
    onClose: () => void;
    onSubmit: (data: GroupInput) => void;
    title: string;
    defaultValues?: { name?: string; description?: string };
    groupMembers?: Member[];
    lockedMemberId?: string;
    isPending?: boolean;
}

const GroupForm = ({ onClose, onSubmit, title, defaultValues = {}, groupMembers, lockedMemberId, isPending = false }: GroupFormProps) => {
    // An existing group cannot go down to a single member: with one participant
    // the expense form sends a boolean instead of a list.
    const minMembers = groupMembers ? 2 : 1;
    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<GroupFormValues>({
        resolver: zodResolver(groupFormSchema),
        defaultValues: {
            name: defaultValues.name,
            description: defaultValues.description,
            members: groupMembers
                ? groupMembers.map((m) => ({ _id: m._id, name: m.name, hasAccount: Boolean(m.user) }))
                : [{ name: "" }]
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "members",
    });

    const handleFormSubmit = (data: GroupFormValues) => {
        onSubmit({
            ...data,
            members: data.members.map(({ _id, name }) => (_id ? { _id, name } : { name })),
        });
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className={styles.form}>
            <div className={styles.top}>
                <h2>{title}</h2>
                <IoCloseOutline className={styles.btn} onClick={onClose} />
            </div>

            <div className={styles.formFields}>
                <div className={styles.formField}>
                    <label htmlFor="name" className={styles.label}>Name</label>
                    <input
                        id="name"
                        type="text"
                        placeholder="Trip to Madrid"
                        autoFocus
                        {...register("name")}
                        className={`${styles.input} ${errors.name ? styles.errorInput : ""}`}
                    />
                    {errors.name && (
                        <span className={styles.errorText}>{errors.name.message}</span>
                    )}
                </div>

                <div className={styles.formField}>
                    <label htmlFor="description" className={styles.label}>Description</label>
                    <input
                        id="description"
                        type="text"
                        placeholder="Trip to madrid in february"
                        {...register("description")}
                        className={`${styles.input} ${errors.description ? styles.errorInput : ""}`}
                    />
                    {errors.description && (
                        <span className={styles.errorText}>{errors.description.message}</span>
                    )}
                </div>

                <div className={styles.formField}>
                    <label className={styles.label}>Group members</label>
                    <p className={styles.hint}>
                        Their name is enough. Anyone can join later from the group link and pick themselves off this list.
                    </p>
                    {fields.map((field, index) => (
                        <div key={field.id} className={styles.memberField}>
                            <div className={styles.row}>
                                <input
                                    id={`member-${index}`}
                                    type="text"
                                    placeholder="Name"
                                    {...register(`members.${index}.name`)}
                                    className={`${styles.input} ${errors.members?.[index]?.name ? styles.errorInput : ""}`}
                                />
                                {field._id && !field.hasAccount && (
                                    <span className={styles.tag}>no account</span>
                                )}
                                <div>
                                    {(!lockedMemberId || field._id !== lockedMemberId) && fields.length > minMembers && (
                                        <IoCloseOutline
                                            className={`${styles.btn} ${styles.redBtn}`}
                                            onClick={() => remove(index)}
                                            id={`remove-member-${index}`}
                                        />
                                    )}
                                </div>
                            </div>
                            {errors.members?.[index]?.name && (
                                <span className={styles.errorText}>{errors.members[index]?.name?.message}</span>
                            )}
                        </div>
                    ))}
                    <Button variant="ghost" type="button" onClick={() => append({ name: "" })} id="add-member" className={styles.addMember}>
                        Add Member
                    </Button>
                </div>
            </div>


            <div className={styles.submit}>
                <Button type="submit" id="submit-btn" loading={isPending}>{title}</Button>
            </div>
        </form>
    );
};


export default GroupForm;
