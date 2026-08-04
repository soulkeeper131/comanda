export type MockProperty = {
  id: string;
  name: string;
  addr: string;
  lat: number;
  lng: number;
  type: string;
  owner: string;
  radius: number;
  vacantSince: string;
  access: string;
  utils: string;
  zones: string[];
  lastVisit: string;
  status: "ok" | "soon" | "overdue";
};

export type MockTemplate = {
  id: string;
  name: string;
  mins: number;
  icon: string;
  season?: string;
  items: MockTemplateItem[];
};

export type MockTemplateItem = {
  zone: string;
  text: string;
  proof: "photo" | "note" | "count" | "none";
  req: boolean;
};

export type MockUser = {
  id: string;
  name: string;
  role: "admin" | "client" | "inspector";
  color: string;
  sub: string;
};

const now = Date.now();
const d = (days: number) => new Date(now - days * 86400000).toISOString();

export const MOCK_USERS: MockUser[] = [
  { id: "u_admin", name: "Владимир", role: "admin", color: "#0E1826", sub: "Диспечер · КОМАНДА" },
  { id: "u_own1", name: "Елена Петрова", role: "client", color: "#7C3AED", sub: "Клиент · живее в Мюнхен" },
  { id: "u_ins1", name: "Мария Стоянова", role: "inspector", color: "#1D4E89", sub: "Инспектор · Център и юг" },
  { id: "u_ins2", name: "Иван Георгиев", role: "inspector", color: "#B45309", sub: "Инспектор · Изток" },
];

export const MOCK_PROPERTIES: MockProperty[] = [
  {
    id: "p1", name: "Апартамент Витоша", addr: "бул. Витоша 42, ет. 3, ап. 7",
    lat: 42.6912, lng: 23.3186, type: "apartment", owner: "u_own1", radius: 75,
    vacantSince: d(420),
    access: "Ключова кутия вдясно от входа, код 4471. Асансьор до 3 ет.",
    utils: "Спирателен кран под мивката в кухнята. Ел. табло в антрето.",
    zones: ["Антре", "Дневна", "Спалня", "Баня", "Кухня"],
    lastVisit: d(3), status: "ok",
  },
  {
    id: "p2", name: "Студио Оборище", addr: "ул. Оборище 18, ет. 2",
    lat: 42.6975, lng: 23.3421, type: "studio", owner: "u_own1", radius: 60,
    vacantSince: d(190),
    access: "Домофон 12. Ключът е в кутия до пощенските кутии, код 3390.",
    utils: "Бойлерът е спрян от таблото. Водата остава пусната.",
    zones: ["Стая", "Баня", "Кухненски бокс"],
    lastVisit: d(10), status: "soon",
  },
  {
    id: "p3", name: "Къща Драгалевци", addr: "ул. Прохлада 9, Драгалевци",
    lat: 42.6389, lng: 23.3172, type: "house", owner: "u_own1", radius: 110,
    vacantSince: d(620),
    access: "Портата се отваря с код 2208. Внимание: съседското куче лае, но е вързано.",
    utils: "Главен кран в шахтата вляво от портата. Отоплението е на минимум 12°C.",
    zones: ["Двор", "Партер", "Спалня 1", "Спалня 2", "Баня", "Мазе"],
    lastVisit: d(22), status: "overdue",
  },
  {
    id: "p4", name: "Апартамент Лозенец", addr: "ул. Кричим 24, ет. 5",
    lat: 42.6738, lng: 23.3208, type: "apartment", owner: "u_own1", radius: 70,
    vacantSince: d(95),
    access: "Асансьор до 5 ет. Ключ в кутия до пощенските кутии, код 9013.",
    utils: "Климатик в дневната. Спирателен кран в банята зад ревизионната вратичка.",
    zones: ["Антре", "Дневна", "Спалня", "Баня", "Кухня", "Тераса"],
    lastVisit: d(5), status: "ok",
  },
  {
    id: "p5", name: "Вила Бояна", addr: "ул. Кумата 61, Бояна",
    lat: 42.6435, lng: 23.2661, type: "villa", owner: "u_own1", radius: 130,
    vacantSince: d(300),
    access: "Ключ при пазача на комплекса. Представи се на входа.",
    utils: "Басейнът е източен. Водата към двора е спряна за зимата.",
    zones: ["Двор", "Партер", "Етаж", "Баня", "Котелно"],
    lastVisit: d(14), status: "soon",
  },
];

export const MOCK_TEMPLATES: MockTemplate[] = [
  {
    id: "t_win", name: "Зимен обход", mins: 45, icon: "❄️", season: "winter",
    items: [
      { zone: "Външно", text: "Фасада, покрив и улуци — оглед отвън за щети", proof: "photo", req: true },
      { zone: "Външно", text: "Пощенска кутия изпразнена, входът изглежда обитаван", proof: "none", req: true },
      { zone: "Външно", text: "Врати и прозорци — следи от опит за взлом", proof: "photo", req: true },
      { zone: "Общо", text: "Проветряване — всички помещения, минимум 15 минути", proof: "photo", req: true },
      { zone: "Общо", text: "Температура в жилището (°C)", proof: "count", req: true },
      { zone: "Общо", text: "Влага и мухъл — стени, ъгли, первази, дограма", proof: "photo", req: true },
    ],
  },
  {
    id: "t_sum", name: "Летен обход", mins: 55, icon: "☀️", season: "summer",
    items: [
      { zone: "Външно", text: "Фасада, покрив и улуци след дъжд и бури", proof: "photo", req: true },
      { zone: "Външно", text: "Двор, тераса и растителност — състояние", proof: "photo", req: true },
      { zone: "Общо", text: "Проветряване на всички помещения", proof: "photo", req: true },
      { zone: "Общо", text: "Обход за нови щети — стени, тавани, подове", proof: "photo", req: true },
      { zone: "Общо", text: "Следи от вода и влага след дъжд", proof: "note", req: true },
      { zone: "Дневна", text: "Климатик — пробно пускане и състояние на филтрите", proof: "note", req: true },
    ],
  },
];
