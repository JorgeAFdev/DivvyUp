export const initialsOf = (name = '') =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('');

export const inviteLinkFor = (inviteCode) => `${window.location.origin}/join/${inviteCode}`;
