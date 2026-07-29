export type MockFinding = {
  id: string;
  propertyId: string;
  propertyName: string;
  jobId: string | null;
  type: string;
  title: string;
  body: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  photos: string[];
  offer: MockOffer | null;
};

export type MockOffer = {
  id: string;
  findingId: string;
  price: number;
  days: number;
  scope: string;
  sentAt: string;
  decision: "pending" | "accepted" | "declined";
};

const now = Date.now();
const d = (days: number) => new Date(now - days * 86400000).toISOString();

export const MOCK_FINDINGS: MockFinding[] = [
  {
    id: "f1",
    propertyId: "p1",
    propertyName: "Апартамент Витоша",
    jobId: null,
    type: "Теч",
    title: "Теч под мивката в кухнята",
    body: "При обход установих водна следа под мивката. Сифонът капе, има следи от корозия по тръбата. Подовата дъска е частично набъбнала.",
    status: "open",
    createdAt: d(2),
    photos: [],
    offer: {
      id: "o1",
      findingId: "f1",
      price: 120,
      days: 2,
      scope: "Смяна на сифон, уплътнения и проверка на тръбите. Включва материали.",
      sentAt: d(1),
      decision: "pending",
    },
  },
  {
    id: "f2",
    propertyId: "p2",
    propertyName: "Студио Оборище",
    jobId: null,
    type: "Мухъл/влага",
    title: "Мухъл в ъгъла на банята",
    body: "В горния десен ъгъл над душа се наблюдава черен мухъл с размери около 20x15 см. Причина — слаба вентилация и висока влажност.",
    status: "open",
    createdAt: d(5),
    photos: [],
    offer: {
      id: "o2",
      findingId: "f2",
      price: 180,
      days: 3,
      scope: "Почистване на мухъл, фунгицидна обработка, боядисване с анти-мухъл боя. Гаранция 2 год.",
      sentAt: d(3),
      decision: "pending",
    },
  },
  {
    id: "f3",
    propertyId: "p3",
    propertyName: "Къща Драгалевци",
    jobId: null,
    type: "Повреда",
    title: "Счупен прозорец на терасата",
    body: "Стъклото на плъзгащата се врата към терасата е напукано (паяжина). Вероятно от температурни промени. Нуждае се от спешна подмяна.",
    status: "open",
    createdAt: d(1),
    photos: [],
    offer: {
      id: "o3",
      findingId: "f3",
      price: 350,
      days: 7,
      scope: "Подмяна на стъклопакет 120x200 см, включва доставка, демонтаж и монтаж.",
      sentAt: d(0.5),
      decision: "pending",
    },
  },
];
