import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/userContextAuth';
import { getGroupByInviteCode, getInviteName, joinGroup, type JoinGroupInput } from '../utils/groupApi';
import { queryKeys } from './queryKeys';

// Public endpoint: it answers only the group name, so it needs no session.
export const useInviteName = (inviteCode: string) =>
    useQuery({
        queryKey: queryKeys.inviteName(inviteCode),
        queryFn: () => getInviteName(inviteCode),
        retry: 0,
    });

export const useInvite = (inviteCode: string) => {
    const { user } = useAuth();

    return useQuery({
        queryKey: queryKeys.invite(inviteCode),
        queryFn: () => getGroupByInviteCode(inviteCode),
        retry: 0,
        enabled: Boolean(user),
    });
};

export const useJoinGroup = (inviteCode: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body: JoinGroupInput) => joinGroup(inviteCode, body),
        onSuccess: (joined) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.groups() });
            queryClient.invalidateQueries({ queryKey: queryKeys.groupDetails(joined._id) });
        },
    });
};
