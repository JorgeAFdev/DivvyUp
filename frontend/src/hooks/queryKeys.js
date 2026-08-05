// Every cache key in the app. Queries and the mutations that invalidate them
// have to agree on the exact array, so they all read it from here.
export const queryKeys = {
    groups: () => ['groups'],
    groupDetails: (groupId) => ['groupDetails', groupId],
    userExpenses: () => ['myExpenses'],
    invite: (inviteCode) => ['invite', inviteCode],
    inviteName: (inviteCode) => ['inviteName', inviteCode],
};
