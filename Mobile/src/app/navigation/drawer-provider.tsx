import { useState } from 'react';
import { DrawerContext } from './drawer-context';

export function DrawerProvider({ children }: React.PropsWithChildren) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <DrawerContext.Provider
      value={{
        isOpen,
        openDrawer: () => setIsOpen(true),
        closeDrawer: () => setIsOpen(false),
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
}