import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/userContextAuth';
import { getGroupDetails } from '../utils/groupApi';
import { queryKeys } from './queryKeys';

export const useGroupDetails = (groupId: string) => {
    const { user } = useAuth();

    return useQuery({
        queryKey: queryKeys.groupDetails(groupId),
        queryFn: () => getGroupDetails(groupId),
        enabled: Boolean(user && groupId),
    });
};
