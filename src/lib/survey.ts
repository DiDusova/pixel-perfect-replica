import { AppWindow, Bot, Files, Lightbulb, Repeat, Rocket, Sparkles, type LucideIcon } from "lucide-react";

export const Q1_OPTIONS = [
  { id: "none", label: "Практически не использую", hint: undefined },
  { id: "chat", label: "Иногда общаюсь с ИИ", hint: "Вопросы, тексты, идеи" },
  { id: "work", label: "Регулярно использую ИИ в рабочих задачах", hint: undefined },
  { id: "files", label: "Уже работаю с файлами, данными, проектами и дополнительными возможностями", hint: undefined },
  { id: "agents", label: "Уже пробовал(а) приложения, автоматизации или агентов", hint: undefined },
] as const;

export const INTERESTS: { id: string; title: string; Icon: LucideIcon }[] = [
  { id: "apps", title: "Создавать собственные приложения и цифровые инструменты", Icon: AppWindow },
  { id: "delegate", title: "Поручать ИИ большие задачи целиком", Icon: Rocket },
  { id: "files", title: "Работать с файлами и рабочими материалами", Icon: Files },
  { id: "automate", title: "Автоматизировать повторяющиеся процессы", Icon: Repeat },
  { id: "assistants", title: "Создавать собственных ИИ-ассистентов", Icon: Bot },
  { id: "analysis", title: "Использовать ИИ для анализа, идей и принятия решений", Icon: Lightbulb },
  { id: "unsure", title: "Пока не знаю — хочу сначала увидеть возможности", Icon: Sparkles },
];

export const TASK_EXAMPLES = [
  "Подготовка презентаций, поиск информации о конкурентах и отчёты после встреч",
  "Отвечать клиентам, вести CRM и не забывать делать follow-up",
  "Быстро делать баннеры и материалы для соцсетей",
  "Разбирать большие документы и находить в них нужную информацию",
];

/**
 * Shape for future AI clustering of free-text tasks.
 * Clusters are generated per group from real answers — no fixed categories.
 */
export type TaskCluster = { title: string; count: number; examples: string[] };

export type Phase = "before" | "after";
