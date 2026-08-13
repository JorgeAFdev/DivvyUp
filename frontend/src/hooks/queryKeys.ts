// Every cache key in the app. Queries and the mutations that invalidate them
// have to agree on the exact array, so they all read it from here.
export const queryKeys = {
    groups: () => ['groups'] as const,
    groupDetails: (groupId: string) => ['groupDetails', groupId] as const,
    userExpenses: () => ['myExpenses'] as const,
    invite: (inviteCode: string) => ['invite', inviteCode] as const,
    inviteName: (inviteCode: string) => ['inviteName', inviteCode] as const,
};
