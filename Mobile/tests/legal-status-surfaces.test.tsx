import { render } from '@testing-library/react-native';

import { LegalDocumentScreen } from '../src/features/legal/LegalScreens';
import { SystemStatusView } from '../src/features/system/SystemScreens';

describe('Legal and trust surfaces', () => {
  it('renders the privacy data inventory and legal-review limitation', async () => {
    const screen = await render(<LegalDocumentScreen kind="privacy" />);
    expect(screen.getByText('Politique de confidentialité')).toBeTruthy();
    expect(screen.getByText(/Google Gemini traite/)).toBeTruthy();
    expect(
      screen.getByText(/Validation par un professionnel du droit/),
    ).toBeTruthy();
  });

  it('renders a native permission error without technical details', async () => {
    const screen = await render(<SystemStatusView kind="forbidden" />);
    expect(screen.getByText('Accès non autorisé')).toBeTruthy();
    expect(screen.getByText('403')).toBeTruthy();
  });
});
