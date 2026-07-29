export interface Property {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  kind: string;
  status: "ok" | "due" | "overdue";
  lastVisit?: string;
  owner: string;
  zones: string[];
}

export interface Zone {
  id: string;
  propertyId: string;
  name: string;
  sort: number;
}

export const mockProperties: Property[] = [
  {
    id: "p1", name: "Апартамент Драгалевци", address: "ул. Тодор Каблешков 14, Драгалевци",
    lat: 42.6253, lng: 23.3026, kind: "apartment", status: "ok",
    lastVisit: "2026-07-28", owner: "Иван Петров",
    zones: ["Кухня", "Дневна", "Спалня", "Баня", "Тераса"]
  },
  {
    id: "p2", name: "Къща Бояна", address: "ул. Кумата 6, Бояна",
    lat: 42.6448, lng: 23.2668, kind: "house", status: "due",
    lastVisit: "2026-07-14", owner: "Мария Стоянова",
    zones: ["Кухня", "Дневна", "Спалня", "Баня", "Двор", "Гараж"]
  },
  {
    id: "p3", name: "Студио Център", address: "ул. Граф Игнатиев 22",
    lat: 42.6941, lng: 23.3239, kind: "studio", status: "ok",
    lastVisit: "2026-07-27", owner: "Георги Димитров",
    zones: ["Кухненски бокс", "Дневна/Спалня", "Баня"]
  },
  {
    id: "p4", name: "Апартамент Лозенец", address: "ул. Златен рог 8, Лозенец",
    lat: 42.6749, lng: 23.3169, kind: "apartment", status: "overdue",
    lastVisit: "2026-06-30", owner: "Елена Костова",
    zones: ["Кухня", "Дневна", "Спалня", "Баня с WC", "Тераса"]
  },
  {
    id: "p5", name: "Мезонет Изток", address: "бул. Цариградско шосе 115",
    lat: 42.6675, lng: 23.3651, kind: "maisonette", status: "due",
    lastVisit: "2026-07-16", owner: "Петър Николов",
    zones: ["Кухня", "Дневна", "2x Спални", "2x Бани", "Тераса", "Мазе"]
  },
  {
    id: "p6", name: "Офис Младост", address: "бул. Александър Малинов 31",
    lat: 42.6464, lng: 23.3841, kind: "office", status: "ok",
    lastVisit: "2026-07-29", owner: "ООД Бизнес Център",
    zones: ["Офис отворен", "Заседателна", "Кухненски бокс", "WC"]
  },
  {
    id: "p7", name: "Апартамент Оборище", address: "ул. Оборище 55",
    lat: 42.6984, lng: 23.3425, kind: "apartment", status: "ok",
    lastVisit: "2026-07-28", owner: "Радослав Йорданов",
    zones: ["Кухня", "Дневна", "Спалня", "Баня"]
  },
  {
    id: "p8", name: "Къща Панчарево", address: "ул. Рилски езера 3, Панчарево",
    lat: 42.5933, lng: 23.4091, kind: "house", status: "overdue",
    lastVisit: "2026-06-15", owner: "Сем. Тодорови",
    zones: ["Кухня", "Трапезария", "3x Спални", "2x Бани", "Двор", "Гараж", "Мазе"]
  },
];

export const mockZones: Zone[] = [];
mockProperties.forEach((p) => {
  p.zones.forEach((name, i) => {
    mockZones.push({ id: `${p.id}-z${i}`, propertyId: p.id, name, sort: i });
  });
});

export function getStatusColor(status: Property["status"]) {
  switch (status) {
    case "ok": return "#16a34a";
    case "due": return "#ea580c";
    case "overdue": return "#dc2626";
  }
}

export function getStatusLabel(status: Property["status"]) {
  switch (status) {
    case "ok": return "Редовен";
    case "due": return "Предстои обход";
    case "overdue": return "Просрочен";
  }
}
