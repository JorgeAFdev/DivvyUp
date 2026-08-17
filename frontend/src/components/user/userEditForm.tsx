import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { userUpdateSchema } from "@monorepo/validation";
import { toast } from "react-toastify";
import type { AuthResponse, SessionUser } from "@monorepo/shared";
import { useUpdateProfile } from "../../hooks/useProfile";
import { getStorageObject, setStorageObject } from "../../utils/localStorage";
import { apiErrorMessage } from "../../utils/apiError";
import styles from "./userEditForm.module.css";
import { IoCloseOutline } from "react-icons/io5";

// The file field is not in the shared body schema, so it is added here as a
// passthrough — like registerForm — or the resolver would strip the upload.
const userFormSchema = userUpdateSchema.extend({ profilePicture: z.any() });

interface UserEditFormValues {
    name: string;
    email: string;
    profilePicture: FileList;
}

const UserEditForm = ({ user, onClose }: { user: SessionUser; onClose: () => void }) => {
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<UserEditFormValues>({
        resolver: zodResolver(userFormSchema),
    });

    const mutation = useUpdateProfile();

    useEffect(() => {
        if (user) {
            setValue("name", user.name);
            setValue("email", user.email);
        }
    }, [user, setValue]);

    const onSubmit = (data: UserEditFormValues) => {
        mutation.mutate(
            { ...data, profilePicture: data.profilePicture?.[0] },
            {
                onSuccess: (updatedUser) => {
                    // The profile screen reads the user straight from the session, not
                    // from a query, so the new data has to land there and the page has
                    // to be repainted with it.
                    const session = getStorageObject<AuthResponse>('user-session') || {};
                    setStorageObject(JSON.stringify({ ...session, user: updatedUser.user }));

                    toast.success("User updated successfully 🎉");
                    onClose();
                    window.location.reload();
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
                <IoCloseOutline className={styles.btn} onClick={onClose} />
            </div>

            <label className={styles.formLabel}>
                Nombre
            </label>
            <input
                type="text"
                className={styles.formInput}
                {...register("name")}
            />
            {errors.name && <p className={styles.errorMessage}>{errors.name.message}</p>}

            <label className={styles.formLabel}>
                Email
            </label>
            <input
                type="email"
                className={styles.formInput}
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
                        alt="Vista previa"
                        className={styles.previewImage}
                    />
                ) : user.profilePicture ? (
                    <img
                        src={user.profilePicture}
                        alt="Foto actual"
                        className={styles.previewImage}
                    />
                ) : (
                    <p>Doesn't upload image</p>
                )}
            </div>

            <button type="submit" className={styles.button} disabled={mutation.isPending}>
                {mutation.isPending ? "Guardando..." : "Guardar cambios"}
            </button>
        </form>
    );
};

export default UserEditForm;
