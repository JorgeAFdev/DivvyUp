import { useForm } from 'react-hook-form';
import api from '../../utils/axios';
import { setStorageObject } from '../../utils/localStorage';
import styles from './loginForm.module.css';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/userContextAuth';
import { toast } from 'react-toastify';
import { useDarkMode } from '../../context/darkModeContext';



const Login = ({ forceUpdate }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({});
  const { login } = useAuth();
  const navigate = useNavigate();
  const {darkMode} = useDarkMode();
  
  const onSubmit = async (data) => {
    try {
      const response = await api.post('/auth/login', data);
      
      if (response?.data.token) {
        login(response.data);
        toast.success('Login successfully 🎉');
        navigate('/groups');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={`${styles.loginContainer} ${darkMode ? styles.loginContainerDark : ''}`} >
      <h2 className={styles.loginTitle}>Login</h2>

      <label htmlFor="email" className={`${styles.loginLabel} ${darkMode ? styles.loginLabelDark : ''}`}>Email:</label>
      <input
        id="email"
        {...register('email', {
          required: 'Email is required',
          pattern: { value: /^\S+@\S+$/i, message: 'Invalid email format' }
        })}
        placeholder="Email"
        className={`${styles.loginInput} ${darkMode ? styles.loginInputDark : ''}`}
      />
      {errors.email && <p className={styles.loginError}>{errors.email.message}</p>}

      <label htmlFor="password" className={`${styles.loginLabel} ${darkMode ? styles.loginLabelDark : ''}`}>Password:</label>
      <input
        id="password"
        {...register('password', {
          required: 'Password is required',
          minLength: { value: 8, message: 'Password must be at least 8 characters' }
        })}
        placeholder="Password"
        type="password"
        className={`${styles.loginInput} ${darkMode ? styles.loginInputDark : ''}`}
      />
      {errors.password && <p className={styles.loginError}>{errors.password.message}</p>}

      <input type="submit" value="Login" className={styles.loginSubmitBtn} />
    </form>
  );
};

export default Login;
