// Standalone script to delete all accounts and usernames from Firestore and Firebase Auth
// Usage: Run with `ts-node` or `node` (after transpiling if needed)
import { deleteAllAccountsAndUsernames } from './devDeleteAllAccounts';

(async () => {
  try {
    await deleteAllAccountsAndUsernames();
    console.log('All accounts and usernames deleted successfully.');
    process.exit(0);
  } catch (e: any) {
    console.error('Failed to delete all accounts:', e);
    process.exit(1);
  }
})();
