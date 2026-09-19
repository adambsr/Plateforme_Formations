import * as SecureStore from 'expo-secure-store';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Appearance, Pressable, Text } from 'react-native';

import { ThemeProvider, useAppTheme } from '../src/shared/theme/ThemeProvider';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const getItemAsync = jest.mocked(SecureStore.getItemAsync);
const setItemAsync = jest.mocked(SecureStore.setItemAsync);

function ThemeProbe() {
  const { theme, toggleTheme } = useAppTheme();
  return (
    <Pressable accessibilityLabel="Changer le thème test" onPress={toggleTheme}>
      <Text>{theme}</Text>
    </Pressable>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setItemAsync.mockResolvedValue();
  });

  it('hydrates the saved theme before rendering the application', async () => {
    let resolveTheme: (value: string | null) => void = () => undefined;
    getItemAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveTheme = resolve;
      }),
    );
    const appearance = jest
      .spyOn(Appearance, 'setColorScheme')
      .mockImplementation(() => undefined);

    const screen = await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.queryByText('light')).toBeNull();

    await act(async () => resolveTheme('dark'));

    expect(screen.getByText('dark')).toBeTruthy();
    expect(appearance).toHaveBeenCalledWith('dark');
    appearance.mockRestore();
  });

  it('applies and persists a theme change immediately', async () => {
    getItemAsync.mockResolvedValue('light');
    const appearance = jest
      .spyOn(Appearance, 'setColorScheme')
      .mockImplementation(() => undefined);
    const screen = await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    await screen.findByText('light');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Changer le thème test'));
    });

    expect(screen.getByText('dark')).toBeTruthy();
    expect(appearance).toHaveBeenLastCalledWith('dark');
    expect(setItemAsync).toHaveBeenCalledWith('hsa-theme', 'dark');
    appearance.mockRestore();
  });
});
