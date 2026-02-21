# Design System for SAFE-LINK

## 1. Concept
"Field Communication OS"
Deep, high-tech dark theme suited for construction environments, providing maximum readability and glove-friendly interaction.

## 2. Colors
- **Background**: Deep Slate / Black (`bg-slate-950`, `bg-slate-900`)
- **Accent (Admin)**: Vivid Blue (`text-blue-400`, `bg-blue-600`)
- **Accent (Worker)**: High-visibility Green/Lime (`text-green-400`, `bg-green-500`)
- **Alert/Danger**: Intense Red (`text-red-400`, `border-red-500`)

## 3. Typography
- Font: Inter (sans-serif)
- Sizes: Extra large titles (`text-3xl`, `text-4xl`), highly legible body.

## 4. Components
- **Buttons**: Very large tap targets (`p-6`, `p-8`), heavily rounded (`rounded-[32px]`), with glassmorphism or subtle glows.
- **Cards**: Dark translucent cards (`bg-slate-800/80`) with borders mapping to roles/accents.

## 6. Design System Notes for Stitch Generation
**DESIGN SYSTEM (REQUIRED for STITCH):**
- **Theme**: Dark Mode
- **Colors**: Deep grey/black backgrounds. Electric blue for admin actions, neon green for worker actions, bright red for alerts/TBM.
- **Style**: Glassmorphism (subtle borders, translucent backgrounds like `bg-slate-800/80`, outer glows).
- **Usability**: Extremely large touch targets, high contrast, large fonts for outdoor visibility.
- **Layout**: Mobile-first, stacked vertical layouts with distinct, separated cards.
