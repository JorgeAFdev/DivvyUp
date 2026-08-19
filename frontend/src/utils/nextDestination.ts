// Only same-site paths are honoured: an absolute URL in ?next= would turn the
// login screen into an open redirect. Must start with a single '/' followed by a
// non-slash: '//host' and '/\host' are protocol-relative (a browser folds '\'
// into '/'), so both resolve off-site and are rejected.
export const nextDestination = (search: string, fallback = '/groups'): string => {
    const next = new URLSearchParams(search).get('next');

    if (!next || !/^\/[^/\\]/.test(next)) {
        return fallback;
    }

    return next;
};
