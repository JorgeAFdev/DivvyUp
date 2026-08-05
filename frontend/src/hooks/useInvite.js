import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/userContextAuth';
import { getGroupByInviteCode, getInviteName, joinGroup } from '../utils/groupApi';
import { queryKeys } from './queryKeys';

// Public endpoint: it answers only the group name, so it takes no token.
export const useInviteName = (inviteCode) =>
    useQuery({
        queryKey: queryKeys.inviteName(inviteCode),
        queryFn: () => getInviteName(inviteCode),
        retry: 0,
    });

export const useInvite = (inviteCode) => {
    const { token } = useAuth();

    return useQuery({
        queryKey: queryKeys.invite(inviteCode),
        queryFn: () => getGroupByInviteCode(inviteCode, token),
        retry: 0,
        enabled: Boolean(token),
    });
};

export const useJoinGroup = (inviteCode) => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body) => joinGroup(inviteCode, body, token),
        onSuccess: (joined) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.groups() });
            queryClient.invalidateQueries({ queryKey: queryKeys.groupDetails(joined._id) });
        },
    });
};
