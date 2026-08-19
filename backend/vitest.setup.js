// Better Auth reads these at call time, like jwt.ts used to read jwt_secret, so
// they only need to exist before the first request. CLIENT_URL feeds
// trustedOrigins; supertest sends no Origin, but the value must be present.
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'test-secret';
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3001';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
// Present so createAuth() builds the Google provider; tests never drive OAuth.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-secret';
