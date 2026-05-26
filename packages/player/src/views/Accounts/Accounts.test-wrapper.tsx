import {
  createMemoryHistory,
  createRouter,
  type RouterHistory,
} from '@tanstack/react-router';
import { render, type RenderResult, screen, within } from '@testing-library/react';

import App from '../../App';
import { routeTree } from '../../routeTree.gen';

export const AccountsWrapper = {
  async mount(): Promise<RenderResult & { history: RouterHistory }> {
    const history = createMemoryHistory({ initialEntries: ['/accounts'] });
    const router = createRouter({ routeTree, history });
    const component = render(<App routerProp={router} />);
    await screen.findByTestId('accounts-view');
    return { ...component, history };
  },

  card(id: string) {
    return screen.getByTestId(`account-card-${id}`);
  },

  actionButton(id: string): HTMLButtonElement {
    return screen.getByTestId(`account-action-${id}`) as HTMLButtonElement;
  },

  get library() {
    return screen.queryByTestId('spotify-library');
  },

  get youtubeLibrary() {
    return screen.queryByTestId('youtube-library');
  },

  section(testid: string) {
    return within(screen.getByTestId(testid));
  },
};
