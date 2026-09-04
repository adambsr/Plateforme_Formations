import { createContext, useContext } from 'react';

interface DrawerContextValue {
  openDrawer(): void;
  closeDrawer(): void;
  isOpen: boolean;
}

const defaultDrawerContext: DrawerContextValue = {
  isOpen: false,
  openDrawer: () => undefined,
  closeDrawer: () => undefined,
};
export const DrawerContext = createContext<DrawerContextValue>(defaultDrawerContext);

export function useDrawer(): DrawerContextValue {
  return useContext(DrawerContext);
}