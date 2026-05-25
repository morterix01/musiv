import { createFileRoute } from '@tanstack/react-router';

import { Charts } from '../views/Charts';

export const Route = createFileRoute('/charts')({
  component: Charts,
});
