import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../utils/axios';
import styles from './registerForm.module.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/userContextAuth';
import { toast } from 'react-toastify';
import { nextDestination } from '../../utils/nextDestination';

const RegisterForm = () => {
    const queryClient = useQueryClient();
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
    const { search } = useLocation();
    const mutation = useMutation({
        mutationFn: createUser,
        onSuccess: (userData) => {
            login(userData);
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Registration successful 🎉');
            navigate(nextDestination(search));
        }
    });

    const onSubmit = (data) => {
        mutation.mutate(data);
    };

    const profilePicture = watch('profilePicture');

    return (
        <form className={styles.registerContainer} onSubmit={handleSubmit(onSubmit)}>
            <h2 className={styles.registerTitle}>Register</h2>

            <label className={styles.registerLabel}>
                Name
            </label>

            <input
                className={styles.registerInput}
                type="text"
                placeholder="Enter your name.."
                {...register('name', {
                    required: 'Name is required',
                    maxLength: { value: 20, message: 'Name is too long' },
                })}
            />
            {errors.name && <p className={styles.registerErrorMessage}>{errors.name.message}</p>}

            <label
                className={styles.registerLabel}>
                Email
            </label>

            <input
                className={styles.registerInput}
                type="text"
                placeholder="example@example.com"
                {...register('email', {
                    pattern: { value: /^\S+@\S+$/i, message: 'Invalid email format' },
                })}
            />

            <label
                className={styles.registerLabel}>
                Password
            </label>

            <input
                className={styles.registerInput}
                type="password"
                placeholder="********"
                {...register('password', {
                    minLength: { value: 8, message: 'Password is too short' },
                    required: true,
                })}
            />
            {errors.password && <p className={styles.registerErrorMessage}>{errors.password.message}</p>}

            <label className={styles.registerLabel}>
                Profile Picture
            </label>

            <input
                className={styles.registerInputFile}
                type="file"
                {...register('profilePicture', {
                    required: 'Profile picture is required',
                    validate: (value) => value.length > 0 || 'You must select an image',
                })}
            />
            {errors.profilePicture && <p className={styles.registerErrorMessage}>{errors.profilePicture.message}</p>}

            <button type="submit" className={styles.registerSubmitButton}>Register</button>

            <p className={styles.registerSwitch}>
                Already have an account? <Link to={`/login${search}`}>Login</Link>
            </p>

            <p>
                {profilePicture?.[0] ? (
                    <img className={styles.registerPreviewImage} src={URL.createObjectURL(profilePicture[0])} alt="Preview" />
                ) : (
                    ''
                )}
            </p>
        </form>
    );
};

export default RegisterForm;
