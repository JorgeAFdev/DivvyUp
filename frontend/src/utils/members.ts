export const initialsOf = (name = ''): string =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('');

export const inviteLinkFor = (inviteCode: string): string => `${window.location.origin}/join/${inviteCode}`;
