import '../src/App.css';
import { DarkModeContextProvider } from '../src/context/darkModeContext';

/** @type { import('@storybook/react').Preview } */
const preview = {
  decorators: [
    (Story) => (
      <DarkModeContextProvider>
        <Story />
      </DarkModeContextProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
  },
};

export default preview;
