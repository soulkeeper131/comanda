export type Property = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  status: "ok" | "warn" | "bad";
  kind: string;
  zones: string[];
  accessNotes: string;
  lastVisit: string;
  plan: string;
};
