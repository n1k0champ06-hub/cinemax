# Design System — Netflix (Cinemax)

This document serves as the single source of truth for the visual theme, component styling, and layout principles of the Cinemax project. AI agents must follow this design guide to ensure visual consistency and a premium, brand-aligned user interface.

---

## 1. Visual Theme & Atmosphere

Netflix's user interface is built on the concept of **"Cinematic Immersion"**. The UI disappears into the shadows so that content (posters, thumbnails, video previews) stands out as the main focus. The visual atmosphere is that of a dark movie theater: deep blacks, dark gray cards, clean white typography, and the iconic Netflix Red as the singular brand accent.

Unlike other platforms that use rounded, pill-like shapes (such as Spotify), Netflix's geometry is **modern, clean, and rectangular**. Buttons and cards use sharp or slightly rounded corners (mostly `4px`), giving the interface a premium, sleek, and structured feel.

**Key Characteristics:**
*   **Immersive Dark Theme:** True black (`#000000`) and near-black (`#141414`) background surfaces.
*   **Netflix Red (`#E50914`):** Used exclusively for primary calls to action, active navigation tabs, brand logos, and progress tracking.
*   **Clean Geometry:** Rectangular grids and buttons with subtle `4px` rounding (never use pills or round badges unless representing avatars).
*   **Micro-interactions:** Hover zoom scale (`1.05x` to `1.15x`) on movie cards with smooth transitions (`cubic-bezier(0.25, 1, 0.5, 1)`).
*   **Content-first Visual Density:** Margins and paddings are structured to maximize screen real estate for media list rows.

---

## 2. Color Palette & Roles

### Primary Brand
*   **Netflix Red** (`#E50914`): Primary brand accent, main CTAs, active status, hover highlights.
*   **Netflix Dark Red** (`#B81D24`): Primary button hover state.
*   **True Black** (`#000000`): Deepest background layer, navigation header base.
*   **Netflix Dark** (`#141414`): Standard page background body.
*   **Dark Surface** (`#181818`): Cards, modal containers, and elevated surfaces.
*   **Elevated Gray** (`#2F2F2F`): Secondary interactive surfaces, tab backgrounds.

### Text & Icons
*   **White** (`#FFFFFF`): Primary text, headings, highlighted items.
*   **Netflix Light Gray** (`#E5E5E5`): Secondary text, subheaders.
*   **Muted Gray** (`#808080`): Descriptions, meta-information, inactive menu links.

### Semantic
*   **Positive Green** (`#46D369`): Match percentage (e.g., "98% Match"), new episodes badge.
*   **Warning Orange** (`#FFA42B`): Ratings, warning states.

---

## 3. Typography Rules

### Font Stack
*   **Primary Font:** `Inter`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `Helvetica Neue`, `Arial`, `sans-serif`.

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Title** | `3rem` to `4.5rem` | 800 (Extra Bold) | 1.1 | `-0.02em` | For main home screen hero banner |
| **Section Header** | `1.5rem` to `1.8rem` | 700 (Bold) | 1.2 | `normal` | Header for movie rows / sliders |
| **Movie Title (Card)** | `1.1rem` | 700 (Bold) | 1.3 | `normal` | Title inside card hover/detail popup |
| **Body (Main)** | `1rem` | 400 (Regular) | 1.5 | `normal` | Movie description paragraphs |
| **Metadata** | `0.875rem` | 500 (Medium) | normal | `normal` | Year, rating, duration info |
| **Button Text** | `1rem` | 600 (Semi-Bold) | normal | `0.025em` | Play / Info buttons |

---

## 4. Component Stylings

### Buttons

**Primary Play Button**
*   **Background:** White (`#FFFFFF`) with fallback.
*   **Text:** True Black (`#000000`).
*   **Border Radius:** `4px`.
*   **Hover State:** Light opacity transition (background: `rgba(255, 255, 255, 0.75)`).
*   **Icon:** Play icon left-aligned.

**Secondary Info Button**
*   **Background:** Muted Translucent Gray (`rgba(109, 109, 110, 0.7)`).
*   **Text:** White (`#FFFFFF`).
*   **Border Radius:** `4px`.
*   **Hover State:** Background becomes slightly lighter (`rgba(109, 109, 110, 0.4)`).
*   **Icon:** Info icon left-aligned.

**Red Brand Action Button**
*   **Background:** Netflix Red (`#E50914`).
*   **Text:** White (`#FFFFFF`).
*   **Border Radius:** `4px`.
*   **Hover State:** Netflix Dark Red (`#B81D24`).

---

### Media Cards (Movie/TV Cards)
*   **Aspect Ratio:** `16:9` landscape (default for Netflix-style rows) or `2:3` portrait (for catalog grid views).
*   **Border Radius:** `4px` (subtle).
*   **Transitions:** `transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)`.
*   **Hover Effect:** Scale `1.08x` with a shadow drop (`rgba(0, 0, 0, 0.75) 0px 10px 25px`).
*   **Title/Meta Overlay:** Transparent to black gradient overlay (`linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)`) at the bottom of the card.

---

### Navigation Bar
*   **Background:** Starts as transparent (`rgba(0, 0, 0, 0)`). Fades to solid black (`#000000`) once scrolled past `50px`.
*   **Transition:** `background-color 0.5s ease-in-out`.
*   **Active Link:** White (`#FFFFFF`) with weight 700.
*   **Inactive Link:** Light Gray (`#E5E5E5`) with weight 400, transitioning to white on hover.

---

## 5. Layout Principles

### Grid & Row Sliders
*   **Horizontal Movie Rows:**
    *   No visible scrollbars (use CSS `-ms-overflow-style: none; scrollbar-width: none;`).
    *   Left/right navigation arrow overlays visible on row hover.
    *   Row spacing (vertical): `3vw` between sliders.
    *   Gap between cards inside rows: `8px`.
*   **Responsive Columns:**
    *   Desktop: 6 cards per row.
    *   Tablet: 4 cards per row.
    *   Mobile: 2 cards per row.

### Hero Banner (Main Spotlight)
*   **Height:** `85vh` to `95vh`.
*   **Fading Overlay:** A dark gradient mask at the bottom to transition smoothly into the rows content:
    `background: linear-gradient(to top, #141414 0%, rgba(20, 20, 20, 0.6) 30%, rgba(20, 20, 20, 0) 100%)`
*   **Placement:** Title and CTA buttons aligned to the left center of the banner.

---

## 6. Do's and Don'ts

### Do
*   **Do** keep background colors restricted to True Black (`#000000`) and Netflix Dark (`#141414`).
*   **Do** use the `4px` border-radius rule for buttons and media cards to preserve the premium cinematic geometry.
*   **Do** use smooth transition animations for card zoom scales and transparent navbar fades.
*   **Do** highlight match rates using Positive Green (`#46D369`) (e.g., `97% Match`).
*   **Do** hide scrollbars on horizontal lists to simulate native TV player UI scrolling.

### Don't
*   **Don't** use standard pill buttons (`9999px` radius) or circle badges for general content.
*   **Don't** use bright gray borders around panels. Let subtle shading differences (e.g., `#181818` vs `#141414`) or shadows create visual separation.
*   **Don't** use custom brand colors other than Netflix Red (`#E50914`) for primary elements.
*   **Don't** put background patterns, grids, or background gradients on body text panels. Everything must fade cleanly into black.
