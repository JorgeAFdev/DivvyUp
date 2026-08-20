import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { userUpdateSchema } from "@monorepo/validation";
import { toast } from "react-toastify";
import { useUpdateProfile, useHasPassword } from "../../hooks/useProfile";
import { useAuth } from "../../context/userContextAuth";
import { setPendingEmailChange } from "../../utils/pendingEmailChange";
import { apiErrorMessage } from "../../utils/apiError";
import styles from "./userEditForm.module.css";
import CloseButton from "../closeButton/closeButton";
import Button from "../button/button";

// The file field is not in the shared body schema, so it is added here as a
// passthrough — like registerForm — or the resolver would strip the upload.
const userFormSchema = userUpdateSchema.extend({ profilePicture: z.any() });

interface UserEditFormValues {
    name: string;
    email: string;
    profilePicture: FileList;
}

export interface EditableUser {
    name: string;
    email: string;
    image?: string | null;
}

const UserEditForm = ({ user, onClose }: { user: EditableUser; onClose: () => void }) => {
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<UserEditFormValues>({
        resolver: zodResolver(userFormSchema),
    });

    const mutation = useUpdateProfile();
    const { data: hasPassword } = useHasPassword();
    const { refetch } = useAuth();
    const emailManagedByProvider = hasPassword === false;

    useEffect(() => {
        if (user) {
            setValue("name", user.name);
            setValue("email", user.email);
        }
    }, [user, setValue]);

    const onSubmit = (data: UserEditFormValues) => {
        const emailChanged = data.email !== user.email;

        mutation.mutate(
            { ...data, profilePicture: data.profilePicture?.[0] },
            {
                onSuccess: () => {
                    // The update goes through our API, not through authClient, so
                    // nothing invalidates the cached session the UI reads its name
                    // and picture from.
                    refetch();
                    if (emailChanged) {
                        setPendingEmailChange(data.email);
                    }
                    toast.success(
                        emailChanged
                            ? "Check your current inbox to confirm the email change."
                            : "User updated successfully 🎉",
                    );
                    onClose();
                },
                onError: (error) => {
                    toast.error(apiErrorMessage(error, "there was an error updating the user"));
                },
            },
        );
    };

    const profilePicture = watch("profilePicture");

    return (
        <form onSubmit={handleSubmit(onSubmit)} className={styles.formContainer}>
            <div className={styles.top}>
                <h2 className={styles.formTitle}>Edit Profile</h2>
                <CloseButton onClick={onClose} />
            </div>

            <label className={styles.formLabel}>
                Name
            </label>
            <input
                type="text"
                className={styles.formInput}
                {...register("name")}
            />
            {errors.name && <p className={styles.errorMessage}>{errors.name.message}</p>}

            <label className={styles.formLabel}>
                Email
                {emailManagedByProvider && <span className={styles.hint}>Managed by your Google login</span>}
            </label>
            <input
                type="email"
                className={styles.formInput}
                disabled={emailManagedByProvider}
                {...register("email")}
            />
            {errors.email && <p className={styles.errorMessage}>{errors.email.message}</p>}

            <label className={styles.formLabel}>
                Profile Picture
            </label>
            <input
                type="file"
                accept="image/*"
                className={styles.formInput}
                {...register("profilePicture")}

            />

            <div className={styles.previewContainer}>
                <h3 className={styles.formLabel}>Preview:</h3>
                {profilePicture?.[0] ? (
                    <img
                        src={URL.createObjectURL(profilePicture[0])}
                        alt="Preview"
                        className={styles.previewImage}
                    />
                ) : user.image ? (
                    <img
                        src={user.image}
                        alt="Current photo"
                        className={styles.previewImage}
                    />
                ) : (
                    <p>No image uploaded</p>
                )}
            </div>

            <Button type="submit" className={styles.fullWidth} loading={mutation.isPending}>
                Save changes
            </Button>
        </form>
    );
};

export default UserEditForm;
