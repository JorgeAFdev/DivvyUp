// Deletes what the Cypress specs leave behind. They register a real account per
// test against the running backend, and there is no endpoint to delete a user,
// so the only way back is here.
//
//   pnpm clean:e2e          # dry run, counts only
//   pnpm clean:e2e --yes    # actually deletes
//
// Only accounts whose email is <letters><timestamp>@test.com go, which is the
// shape every spec builds with Date.now(). javi@divvyup.test and
// ana@divvyup.test have no digits and a different domain, so they survive.
import 'dotenv/config';
import mongoose from 'mongoose';

const SPEC_EMAIL = /^[a-zA-Z]+\d{10,}@test\.com$/;
const commit = process.argv.includes('--yes');

(async () => {
    await mongoose.connect(process.env.MONGO_URL as string);
    const db = mongoose.connection;

    // The one mistake this script must never make. Local and Koyeb share the
    // cluster; only the database in the path tells them apart.
    if (db.name !== 'test') {
        console.error(`Refusing to run against the "${db.name}" database. This script is for "test".`);
        await mongoose.disconnect();
        process.exit(1);
    }

    // Better Auth's user collection is 'user' (singular), not the Mongoose 'users'
    // the old auth used. Its account (password) and session rows hang off userId.
    const users = await db.collection('user').find({ email: SPEC_EMAIL }, { projection: { _id: 1 } }).toArray();
    const userIds = users.map((user) => user._id);

    // A spec group always has its creator as a member with an account, so this
    // reaches every group they made, and no group of a real account.
    const groups = await db.collection('groups')
        .find({ 'members.user': { $in: userIds } }, { projection: { _id: 1 } })
        .toArray();
    const groupIds = groups.map((group) => group._id);

    const expenses = await db.collection('expenses').countDocuments({ group: { $in: groupIds } });
    const payments = await db.collection('payments').countDocuments({ group: { $in: groupIds } });
    const accounts = await db.collection('account').countDocuments({ userId: { $in: userIds } });
    const sessions = await db.collection('session').countDocuments({ userId: { $in: userIds } });

    console.log(`database: ${db.name}`);
    console.log(`users:    ${userIds.length} / ${await db.collection('user').countDocuments()}`);
    console.log(`accounts: ${accounts} / ${await db.collection('account').countDocuments()}`);
    console.log(`sessions: ${sessions} / ${await db.collection('session').countDocuments()}`);
    console.log(`groups:   ${groupIds.length} / ${await db.collection('groups').countDocuments()}`);
    console.log(`expenses: ${expenses} / ${await db.collection('expenses').countDocuments()}`);
    console.log(`payments: ${payments} / ${await db.collection('payments').countDocuments()}`);

    if (!commit) {
        console.log('\nDry run. Nothing deleted. Pass --yes to delete the counts above.');
        await mongoose.disconnect();
        return;
    }

    // Children first: a crash halfway leaves orphan expenses pointing at a group
    // that is gone, which is worse than leaving the group.
    const deletedPayments = await db.collection('payments').deleteMany({ group: { $in: groupIds } });
    const deletedExpenses = await db.collection('expenses').deleteMany({ group: { $in: groupIds } });
    const deletedGroups = await db.collection('groups').deleteMany({ _id: { $in: groupIds } });
    const deletedSessions = await db.collection('session').deleteMany({ userId: { $in: userIds } });
    const deletedAccounts = await db.collection('account').deleteMany({ userId: { $in: userIds } });
    const deletedUsers = await db.collection('user').deleteMany({ _id: { $in: userIds } });

    console.log('\ndeleted:', {
        payments: deletedPayments.deletedCount,
        expenses: deletedExpenses.deletedCount,
        groups: deletedGroups.deletedCount,
        sessions: deletedSessions.deletedCount,
        accounts: deletedAccounts.deletedCount,
        users: deletedUsers.deletedCount,
    });

    await mongoose.disconnect();
})();
