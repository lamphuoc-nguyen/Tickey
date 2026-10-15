import { create } from 'zustand';

/** Memory only: never write names, passwords, OTP or bank details to persistent storage. */
export const useFormStore = create<{
  values: Record<string, object>;
  set: (key: string, value: object) => void;
  clear: (key?: string) => void;
}>((set) => ({
  values: {},
  set: (key, value) => set((s) => ({ values: { ...s.values, [key]: value } })),
  clear: (key) =>
    set((s) => ({
      values: key ? Object.fromEntries(Object.entries(s.values).filter(([k]) => k !== key)) : {},
    })),
}));
