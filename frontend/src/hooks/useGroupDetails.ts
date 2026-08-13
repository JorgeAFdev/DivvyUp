import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/userContextAuth';
import { getGroupDetails } from '../utils/groupApi';
import { queryKeys } from './queryKeys';

export const useGroupDetails = (groupId: string) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: queryKeys.groupDetails(groupId),
        queryFn: () => getGroupDetails(groupId, token),
        enabled: Boolean(token && groupId),
    });
};
