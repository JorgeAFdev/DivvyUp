import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@monorepo/validation';
import styles from '../auth/authForm.module.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLogin, type LoginCredentials } from '../../hooks/useSession';
import { toast } from 'react-toastify';
import { nextDestination } from '../../utils/nextDestination';
import { apiErrorMessage } from '../../utils/apiError';
import SocialAuth from '../auth/socialAuth';
import Button from '../button/button';
import FormField from '../formField/formField';
import PasswordInput from '../formField/passwordInput';


const Login = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
  });
  const navigate = useNavigate();
  const { search } = useLocation();

  const login = useLogin();

  const onSubmit = (data: LoginCredentials) => {
    login.mutate(data, {
      onSuccess: () => {
        navigate(nextDestination(search));
      },
      onError: (error) => {
        toast.error(apiErrorMessage(error, 'Login failed. Please try again.'));
      },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.container} >
      <h2 className={styles.title}>Login</h2>

      <SocialAuth />

      <FormField
        id="email"
        label="Email"
        placeholder="Email"
        error={errors.email}
        {...register('email')}
      />

      <PasswordInput
        id="password"
        label="Password"
        placeholder="Password"
        error={errors.password}
        {...register('password')}
      />

      <Link to="/forgot-password" className={styles.forgot}>Forgot password?</Link>

      <Button type="submit" className={styles.submit} loading={login.isPending}>Login</Button>

      <p className={styles.switch}>
        No account yet? <Link to={`/register${search}`}>Register</Link>
      </p>
    </form>
  );
};

export default Login;
