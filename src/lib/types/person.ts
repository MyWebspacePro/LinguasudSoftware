import type { Role } from "@/lib/roles";

export const SALUTATIONS = ["herr", "frau", "divers"] as const;

export type Salutation = (typeof SALUTATIONS)[number];

export type Person = {
  id: string;
  email: string;
  salutation: Salutation | null;
  firstName: string;
  lastName: string;
  phone1: string | null;
  phone2: string | null;
  whatsappOk: boolean;
  signalOk: boolean;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  addressExtra: string | null;
  active: boolean;
  roles: Role[];
};
