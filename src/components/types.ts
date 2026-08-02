export type Property = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  status: "ok" | "in_progress" | "warning" | "overdue";
  kind: string;
  zones: string[];
  accessNotes: string;
  lastVisit: string;
  plan: string;
};
