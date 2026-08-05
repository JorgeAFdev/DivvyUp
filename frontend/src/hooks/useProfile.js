import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/userContextAuth';
import { updateUser } from '../utils/userApi';

export const useUpdateProfile = () => {
    const { token } = useAuth();

    return useMutation({
        mutationFn: (data) => updateUser(data, token),
    });
};
