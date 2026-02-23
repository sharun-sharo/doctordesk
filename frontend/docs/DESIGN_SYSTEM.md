# Doctor Desk – Design System

Doctor-friendly, minimal, and accessible.

## Tech

- **React (Vite)** + **Tailwind CSS**
- **Lucide React** (icons)
- **Headless UI** (Dialog, Menu)
- **Recharts** (charts)

## Colors

| Token    | Usage              | Value        |
|----------|--------------------|--------------|
| Primary  | Buttons, links     | `#2563EB`    |
| Surface  | Page background    | `#F8FAFC`    |
| Success  | Completed, active  | Soft green   |
| Warning  | Pending, low stock | Amber        |
| Danger   | Delete, cancel     | Soft red     |

Use `primary-50` to `primary-900`, `surface`, `success`, `warning`, `danger` in Tailwind.

## Typography

- **Font:** Inter (sans-serif)
- **Display:** 1.75rem, semibold (page titles)
- **Title:** 1.25rem, semibold (card titles)
- **Body:** 1rem / 0.9375rem
- **Label:** 0.875rem, medium (form labels)
- **Caption:** 0.8125rem (hints, meta)

Classes: `text-display`, `text-title`, `text-body`, `text-body-lg`, `text-label`, `text-caption`.

## Spacing & layout

- **Cards:** `rounded-xl`, `shadow-card`, `p-6`
- **Sections:** `space-y-6` or `gap-6`
- **Inputs:** `py-2.5`, `px-4`, `rounded-lg`

## Components (`src/components/ui/`)

| Component   | Purpose                          |
|------------|-----------------------------------|
| Sidebar    | Fixed left nav, collapse, role-based |
| Header     | Page title, search, notifications, profile |
| StatCard   | Dashboard metrics with icon      |
| DataTable  | Sortable table + pagination + loading skeleton |
| Modal      | Headless UI Dialog wrapper       |
| FormInput  | Label, input, error, hint        |
| StatusBadge| Colored status pill              |
| Spinner    | Loading indicator                |
| Skeleton   | Loading placeholders             |

## Buttons

- `btn-primary` – main actions (min-height 44px, rounded-2xl, primary-600)
- `btn-secondary` – secondary/cancel (border-2, gray)
- `btn-outline` – outline primary (border primary, fill on hover)
- `btn-ghost` – low emphasis
- `btn-danger` – destructive (red border/background tint)

## Tabs

- **Component:** `Tabs` in `src/components/ui/Tabs.jsx` – pill-style tab group (`options`, `value`, `onChange`, `aria-label`).
- **Classes:** `tabs-pill` (wrapper), `tab-pill`, `tab-pill-active`, `tab-pill-inactive` for custom tab UIs (e.g. with icons).

## Role-based nav

- **Super Admin:** Dashboard, Patients, Appointments, Prescriptions, Billing, Inventory, Reports, Users, Activity Logs, Login History, Settings
- **Admin:** + Reports, Settings (no Users/Activity)
- **Doctor:** Dashboard, Appointments, Prescriptions, Inventory
- **Receptionist:** Dashboard, Patients, Appointments, Billing, Inventory

Defined in `src/lib/navConfig.js`.

## Accessibility

- Focus visible ring (`ring-2 ring-primary-500`)
- `prefers-reduced-motion` respected in CSS
- Labels and ARIA where needed (FormInput, Modal)
