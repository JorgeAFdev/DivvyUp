import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from 'react-query';
import api from '../../utils/axios';
import styles from './registerForm.module.css';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/userContextAuth';
import { toast } from 'react-toastify';
import { useDarkMode } from '../../context/darkModeContext';

const RegisterForm = () => {
    const queryClient = useQueryClient();
    const {darkMode} = useDarkMode();
    const { register, handleSubmit, watch, formState: { errors } } = useForm();

    const createUser = async (data) => {
        try {
            const formData = new FormData();
            formData.append('name', data.name);
            formData.append('email', data.email);
            formData.append('password', data.password);
            formData.append('profilePicture', data.profilePicture[0]);

            const response = await api.post('/auth/register', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            return response.data;
        } catch (error) {
            const errorMessage = error.response?.data?.error || 'Registration failed. Please try again.';
            toast.error(errorMessage);
        }
    };

    const { login } = useAuth();
    const navigate = useNavigate();
    const mutation = useMutation(createUser, {
        onSuccess: (userData) => {
            login(userData);
            queryClient.invalidateQueries('users');
            toast.success('Registration successful 🎉');
            navigate('/groups');
        }
    });

    const onSubmit = (data) => {
        mutation.mutate(data);
    };

    const profilePicture = watch('profilePicture');

    return (
        <form className={`${styles.registerContainer} ${darkMode ? styles.registerContainerDark : ''}`} onSubmit={handleSubmit(onSubmit)}>
            <h2 className={styles.registerTitle}>Register</h2>

            <label className={`${styles.registerLabel} ${darkMode ? styles.registerLabelDark : ''}`}>
                Name:
                <input
                    className={`${styles.registerInput} ${darkMode ? styles.registerInputDark : ''}`}
                    type="text"
                    placeholder="Enter your name.."
                    {...register('name', {
                        required: 'Name is required',
                        maxLength: { value: 20, message: 'Name is too long' },
                    })}
                />
                {errors.name && <p className={styles.registerErrorMessage}>{errors.name.message}</p>}
            </label>

            <label 
            className={`${styles.registerLabel} ${darkMode ? styles.registerLabelDark : ''}`}>
                Email:
                <input
                    className={`${styles.registerInput} ${darkMode ? styles.registerInputDark : ''}`}
                    type="text"
                    placeholder="example@example.com"
                    {...register('email', {
                        pattern: { value: /^\S+@\S+$/i, message: 'Invalid email format' },
                    })}
                />
            </label>

            <label 
                className={`${styles.registerLabel} ${darkMode ? styles.registerLabelDark : ''}`}>
                Password:
                <input
                    className={`${styles.registerInput} ${darkMode ? styles.registerInputDark : ''}`}
                    type="password"
                    placeholder="********"
                    {...register('password', {
                        minLength: { value: 8, message: 'Password is too short' },
                        required: true,
                    })}
                />
                {errors.password && <p className={styles.registerErrorMessage}>{errors.password.message}</p>}
            </label>

            <label className={`${styles.registerLabel} ${darkMode ? styles.registerLabelDark : ''}`}>
                Profile Picture:
                <input
                     className={`${styles.registerInputFile} ${darkMode ? styles.registerInputFileDark : ''}`}
                    type="file"
                    {...register('profilePicture', {
                        required: 'Profile picture is required',
                        validate: (value) => value.length > 0 || 'You must select an image',
                    })}
                />
                {errors.profilePicture && <p className={styles.registerErrorMessage}>{errors.profilePicture.message}</p>}
            </label>

            <button type="submit" className={styles.registerSubmitButton}>Register</button>

            <p>
                {profilePicture?.[0] ? (
                    <img className={styles.registerPreviewImage} src={URL.createObjectURL(profilePicture[0])} alt="Preview" />
                ) : (
                    'No image selected'
                )}
            </p>
        </form>
    );
};

export default RegisterForm;
