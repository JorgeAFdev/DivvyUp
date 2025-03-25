import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "react-query";
import api from "../../utils/axios"; // Usa axios desde api.js
import { toast } from "react-toastify";
import { useAuth } from "../../context/userContextAuth";
import styles from "./userEditForm.module.css"; // Mantiene los estilos CSS

const UserEditForm = ({ user, onClose }) => {
    const queryClient = useQueryClient();
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm();
    const { token } = useAuth(); // Token de autenticación

    // Cargar los datos actuales del usuario en el formulario
    useEffect(() => {
        if (user) {
            setValue("name", user.name);
            setValue("email", user.email);
        }
    }, [user, setValue]);

    // Función para actualizar el usuario en el backend
    const updateUser = async (data) => {
        try {
            const formData = new FormData();
            formData.append("name", data.name);
            formData.append("email", data.email);
            
            // Verificar si se subió una nueva imagen
            if (data.profilePicture?.[0]) {
                formData.append("profilePicture", data.profilePicture[0]);
            }

            // Enviar la petición PATCH al backend usando Axios
            const response = await api.patch("/user/update", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    Authorization: `Bearer ${token}`
                }
            });

            return response.data;
        } catch (error) {
            toast.error(error.response?.data?.error || "Error al actualizar el usuario.");
            throw error;
        }
    };

    // React Query Mutation para manejar la actualización
    const mutation = useMutation(updateUser, {
        onSuccess: (updatedUser) => {
            // Obtener sesión actual y actualizarla con los nuevos datos
            const session = JSON.parse(localStorage.getItem("user-session")) || {};
            session.user = updatedUser.user;
            localStorage.setItem("user-session", JSON.stringify(session));

            // Actualizar la caché de React Query
            queryClient.setQueryData("users", (oldData) => {
                if (!oldData) return [updatedUser.user];
                return oldData.map((u) => (u.id === updatedUser.user.id ? updatedUser.user : u));
            });
            window.location.reload();

            // Notificar éxito y cerrar el formulario
            toast.success("¡Usuario actualizado con éxito! 🎉");
            onClose();
        },
        onError: () => {
            toast.error("Hubo un error al actualizar el usuario.");
        }
    });

    // Manejo de envío del formulario
    const onSubmit = (data) => {
        mutation.mutate(data);
    };

    // Obtener la vista previa de la imagen
    const profilePicture = watch("profilePicture");

    return (
        <form onSubmit={handleSubmit(onSubmit)} className={styles.formContainer}>
            <h2 className={styles.formTitle}>Edit User:</h2>

            <label className={styles.formLabel}>
                Nombre:
                <input
                    type="text"
                    className={styles.formInput}
                    {...register("name", {
                        required: "El nombre es obligatorio",
                        maxLength: { value: 50, message: "El nombre es demasiado largo" }
                    })}
                />
                {errors.name && <p className={styles.errorMessage}>{errors.name.message}</p>}
            </label>

            <label className={styles.formLabel}>
                Email:
                <input
                    type="email"
                    className={styles.formInput}
                    {...register("email", {
                        required: "El email es obligatorio",
                        pattern: { value: /^\S+@\S+$/i, message: "Formato de email inválido" }
                    })}
                />
                {errors.email && <p className={styles.errorMessage}>{errors.email.message}</p>}
            </label>

            <label className={styles.formLabel}>
                Profile Picture:
                <input
                    type="file"
                    accept="image/*"
                    className={styles.formInput}
                    {...register("profilePicture")}
                    
                />
            </label>

            <div className={styles.previewContainer}>
                <h3>Preview:</h3>
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

            <button type="submit" className={styles.button} disabled={mutation.isLoading}>
                {mutation.isLoading ? "Guardando..." : "Guardar cambios"}
            </button>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
                Cancelar
            </button>
        </form>
    );
};

export default UserEditForm;
