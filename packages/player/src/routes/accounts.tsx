import { createFileRoute } from '@tanstack/react-router';

import { Accounts } from '../views/Accounts';

export const Route = createFileRoute('/accounts')({
  component: Accounts,
});
