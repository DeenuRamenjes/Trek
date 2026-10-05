import type { FormState } from '../goalFormSchema';

export type SetField = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

export type SectionProps = {
  values: FormState;
  set: SetField;
  open: boolean;
  onToggle: () => void;
};
