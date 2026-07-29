import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const now = Date.now();
const d = (days: number) => new Date(now - days * 86400000).toISOString();

export type JobRecord = {
  id: string;
  propertyName: string;
  propertyId: string;
  date: string;
  worker: string;
  workerId: string;
  itemsChecked: number;
  itemsTotal: number;
  photoCount: number;
  status: "ok" | "warn" | "bad";
  notes: string;
};

const MOCK_JOBS: JobRecord[] = [
  {
    id: "j1",
    propertyName: "Апартамент Витоша",
    propertyId: "p1",
    date: d(2),
    worker: "Работник",
    workerId: "u3",
    itemsChecked: 16,
    itemsTotal: 16,
    photoCount: 8,
    status: "ok",
    notes: "Всичко е наред. Проветрено, проверени прозорци и кранове.",
  },
  {
    id: "j2",
    propertyName: "Студио Оборище",
    propertyId: "p2",
    date: d(5),
    worker: "Работник",
    workerId: "u3",
    itemsChecked: 12,
    itemsTotal: 12,
    photoCount: 6,
    status: "ok",
    notes: "Студиото е в отлично състояние. Няма следи от влага.",
  },
  {
    id: "j3",
    propertyName: "Къща Драгалевци",
    propertyId: "p3",
    date: d(7),
    worker: "Работник",
    workerId: "u3",
    itemsChecked: 14,
    itemsTotal: 18,
    photoCount: 10,
    status: "warn",
    notes: "Открита влага в мазето. Има нужда от проверка на покрива след дъжд.",
  },
  {
    id: "j4",
    propertyName: "Апартамент Лозенец",
    propertyId: "p4",
    date: d(12),
    worker: "Работник",
    workerId: "u3",
    itemsChecked: 15,
    itemsTotal: 16,
    photoCount: 7,
    status: "ok",
    notes: "Всичко е чисто и подредено. Терасата е почистена от листа.",
  },
  {
    id: "j5",
    propertyName: "Вила Бояна",
    propertyId: "p5",
    date: d(18),
    worker: "Работник",
    workerId: "u3",
    itemsChecked: 11,
    itemsTotal: 18,
    photoCount: 12,
    status: "bad",
    notes: "Счупен прозорец на първия етаж. Теч от банята на втория етаж. Влага в котелното.",
  },
];

export async function GET() {
  return NextResponse.json(MOCK_JOBS);
}
