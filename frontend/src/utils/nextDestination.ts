// Only same-site paths are honoured: an absolute URL in ?next= would turn the
// login screen into an open redirect.
export const nextDestination = (search: string, fallback = '/groups'): string => {
    const next = new URLSearchParams(search).get('next');

    if (!next || !next.startsWith('/') || next.startsWith('//')) {
        return fallback;
    }

    return next;
};
