import { Fragment } from "react";
import type { Metadata } from "next";
import {
  BarChart3,
  Bell,
  Bookmark,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Menu,
  MoreHorizontal,
  Search,
  Share,
  SlidersHorizontal,
  Tag,
  User,
  type LucideIcon,
} from "lucide-react";
import { ArticleCard } from "@/components/ui/article-card";
import { BiasMeter } from "@/components/ui/bias-meter";
import {
  Button,
  buttonHoverPreviewClasses,
  type ButtonVariant,
} from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Logo } from "@/components/ui/logo";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Design System — SKEW news",
  description:
    "Tokens, typography, and UI primitives for SKEW news. Design System v1.0.",
};

/*
  Documentation-only fill for the spacing and grid diagrams. Deliberately not a
  brand token — it exists to visualise measurements, never to style product UI.
*/
const DIAGRAM_FILL = "#DEDCFB";

const DESIGN_SYSTEM_VERSION = "Design System v1.0";
/* Static, not generated at render time — the sheet must render deterministically. */
const DESIGN_SYSTEM_DATE = "June 1, 2026";

type Swatch = { token: string; name: string; hex: string };

/*
  `token` names the CSS custom property, so each swatch is painted with the real
  token value (`var(--color-…)`) rather than a hardcoded colour. app/globals.css
  stays the single source of truth; `hex` is the printed label for that token.
*/
const COLOR_GROUPS: { title: string; columns: string; swatches: Swatch[] }[] = [
  {
    title: "Primary",
    columns: "grid-cols-3",
    swatches: [
      { token: "text-primary", name: "Text primary", hex: "#0D0D0F" },
      { token: "text-secondary", name: "Text secondary", hex: "#6B7280" },
      { token: "surface", name: "Surface", hex: "#F6F6F6" },
    ],
  },
  {
    title: "Semantic",
    columns: "grid-cols-3",
    swatches: [
      { token: "bias-left", name: "Left bias", hex: "#B42318" },
      { token: "bias-center", name: "Center", hex: "#E5E7EB" },
      { token: "bias-right", name: "Right bias", hex: "#1D4ED8" },
    ],
  },
  {
    title: "Neutrals",
    columns: "grid-cols-4",
    swatches: [
      { token: "bg-primary", name: "BG primary", hex: "#FFFFFF" },
      { token: "bg-secondary", name: "BG secondary", hex: "#F0F0F0" },
      { token: "border", name: "Border", hex: "#E5E7EB" },
      { token: "divider", name: "Divider", hex: "#E5E7EB" },
    ],
  },
];

const TYPE_SCALE = [
  {
    name: "H1",
    usage: "Page / Screen Title",
    size: "32px",
    weight: "Bold",
    lineHeight: "1.2",
    specimen: "text-h1 font-bold",
  },
  {
    name: "H2",
    usage: "Section Title",
    size: "24px",
    weight: "SemiBold",
    lineHeight: "1.3",
    specimen: "text-h2 font-semibold",
  },
  {
    name: "H3",
    usage: "Card / Module Title",
    size: "20px",
    weight: "SemiBold",
    lineHeight: "1.3",
    specimen: "text-h3 font-semibold",
  },
  {
    name: "H4",
    usage: "Subheading",
    size: "16px",
    weight: "Medium",
    lineHeight: "1.4",
    specimen: "text-h4 font-medium",
  },
  {
    name: "Body Large",
    usage: "Important content",
    size: "16px",
    weight: "Regular",
    lineHeight: "1.6",
    specimen: "text-body-lg font-semibold",
  },
  {
    name: "Body Medium",
    usage: "Body text",
    size: "14px",
    weight: "Regular",
    lineHeight: "1.6",
    specimen: "text-body-md font-semibold",
  },
  {
    name: "Body Small",
    usage: "Supporting text",
    size: "13px",
    weight: "Regular",
    lineHeight: "1.6",
    specimen: "text-body-sm font-semibold",
  },
  {
    name: "Caption",
    usage: "Labels, meta text",
    size: "11px",
    weight: "Regular",
    lineHeight: "1.4",
    specimen: "text-caption font-semibold",
  },
];

const BUTTON_ROWS: {
  label: string;
  variant: ButtonVariant;
  /** The "Outline" column always shows the outlined `secondary` variant. */
  outline: ButtonVariant | null;
  disabled: boolean;
}[] = [
  { label: "Primary", variant: "primary", outline: "secondary", disabled: true },
  {
    label: "Secondary",
    variant: "secondary",
    outline: "secondary",
    disabled: true,
  },
  { label: "Text", variant: "text", outline: null, disabled: false },
];

const BUTTON_STATE_COLUMNS = ["Default", "Hover", "Outline", "Disabled"];

/* Density override so the four-column matrix fits the panel width. */
const MATRIX_BUTTON = "w-full px-2 text-body-sm";

const CHIPS = ["World Cup", "IPL", "Business & Markets", "More"];

const ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: "Menu", Icon: Menu },
  { name: "Search", Icon: Search },
  { name: "Bookmark", Icon: Bookmark },
  { name: "Clock", Icon: Clock },
  { name: "Info", Icon: Info },
  { name: "Share", Icon: Share },
  { name: "External link", Icon: ExternalLink },
  { name: "Calendar", Icon: Calendar },
  { name: "Analytics", Icon: BarChart3 },
  { name: "Tag", Icon: Tag },
  { name: "User", Icon: User },
  { name: "Notifications", Icon: Bell },
  { name: "Filters", Icon: SlidersHorizontal },
  { name: "Check", Icon: CheckCircle2 },
  { name: "More", Icon: MoreHorizontal },
];

const SPACING_STEPS = [4, 8, 16, 24, 32, 40, 64];

const GRID_SPECS = [
  { label: "Container", value: "1280px" },
  { label: "Columns", value: "12" },
  { label: "Gutter", value: "24px" },
  { label: "Margin", value: "24px" },
];

const SHADOWS = [
  { name: "Small", className: "shadow-sm", css: "0px 1px 2px rgba(0,0,0,0.05)" },
  { name: "Medium", className: "shadow-md", css: "0px 4px 12px rgba(0,0,0,0.08)" },
  { name: "Large", className: "shadow-lg", css: "0px 12px 24px rgba(0,0,0,0.12)" },
];

const RADII = [
  { name: "Small", value: "4px", className: "rounded-sm" },
  { name: "Medium", value: "8px", className: "rounded-md" },
  { name: "Large", value: "12px", className: "rounded-lg" },
  { name: "Full", value: "9999px", className: "rounded-full" },
];

const MOCK_ARTICLE = {
  title: "Trump Sends Iran Revised Peace Proposal With Tougher Terms: Report",
  summary:
    "The proposal includes stricter limits on uranium enrichment and enhanced verification measures.",
  category: "Politics",
  country: "United States",
  timeAgo: "2h ago",
  readingTime: "12 min read",
  bias: { left: 25, center: 50, right: 25 },
};

const SUB_LABEL = "text-caption font-semibold uppercase tracking-wider text-text-primary";
const COLUMN_LABEL = "text-caption uppercase tracking-wider text-text-secondary";

function Dash() {
  return (
    <span aria-hidden className="text-center text-body-sm text-text-secondary">
      —
    </span>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="flex-1 bg-surface">
      <div className="mx-auto max-w-page px-6 py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-6 lg:grid-cols-12">
          {/* ---------------------------------------------------- BRAND */}
          <Panel
            label="Brand"
            className="md:col-span-3 lg:col-span-3"
          >
            <div className="flex h-full flex-col items-center justify-center gap-6 py-4 text-center">
              <Logo />
              <p className="text-body-md text-text-secondary">
                Balanced news coverage,
                <br />
                powered by AI.
              </p>
            </div>
          </Panel>

          {/* ----------------------------------------------- TYPOGRAPHY */}
          <Panel label="Typography" className="md:col-span-3 lg:col-span-5">
            <div className="flex flex-col gap-8 lg:flex-row">
              <div className="lg:w-36 lg:shrink-0">
                <p className={SUB_LABEL}>Font family</p>
                <p className="mt-3 text-h1 font-semibold tracking-tight">
                  Poppins
                </p>
                <p className="mt-3 text-body-sm text-text-secondary">
                  Poppins is a modern geometric sans-serif typeface that ensures
                  clarity and excellent readability.
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-baseline gap-x-3 gap-y-3">
                  <span className={COLUMN_LABEL}>Style</span>
                  <span className={cn(COLUMN_LABEL, "text-right")}>Size</span>
                  <span className={cn(COLUMN_LABEL, "text-right")}>Weight</span>
                  <span className={cn(COLUMN_LABEL, "text-right")}>
                    Line height
                  </span>

                  {TYPE_SCALE.map((style) => (
                    <Fragment key={style.name}>
                      <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
                        <span className={style.specimen}>{style.name}</span>
                        <span className="text-body-sm text-text-secondary">
                          {style.usage}
                        </span>
                      </span>
                      <span className="text-right text-caption text-text-primary">
                        {style.size}
                      </span>
                      <span className="text-right text-caption text-text-primary">
                        {style.weight}
                      </span>
                      <span className="text-right text-caption text-text-primary">
                        {style.lineHeight}
                      </span>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          {/* ---------------------------------------------- UI ELEMENTS */}
          <Panel label="UI elements" className="md:col-span-6 lg:col-span-4">
            <div className="flex flex-col gap-8">
              <div>
                <p className={SUB_LABEL}>Buttons</p>
                <div className="mt-4 grid grid-cols-[auto_repeat(4,minmax(0,1fr))] items-center gap-2">
                  <span />
                  {BUTTON_STATE_COLUMNS.map((state) => (
                    <span
                      key={state}
                      className={cn(COLUMN_LABEL, "text-center")}
                    >
                      {state}
                    </span>
                  ))}

                  {BUTTON_ROWS.map((row) => (
                    <Fragment key={row.label}>
                      <span className="pr-2 text-body-sm text-text-secondary">
                        {row.label}
                      </span>

                      <Button variant={row.variant} className={MATRIX_BUTTON}>
                        Button
                      </Button>

                      {/* Static hover preview — real hover is CSS-only. */}
                      <span
                        className={cn(
                          buttonHoverPreviewClasses(row.variant),
                          MATRIX_BUTTON,
                        )}
                      >
                        Button
                      </span>

                      {row.outline ? (
                        <Button variant={row.outline} className={MATRIX_BUTTON}>
                          Button
                        </Button>
                      ) : (
                        <Dash />
                      )}

                      {row.disabled ? (
                        <Button
                          variant={row.variant}
                          className={MATRIX_BUTTON}
                          disabled
                        >
                          Button
                        </Button>
                      ) : (
                        <Dash />
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>

              <div>
                <p className={SUB_LABEL}>Chip / Category</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {CHIPS.map((chip) => (
                    <Chip key={chip} label={chip} />
                  ))}
                </div>
              </div>

              <div>
                <p className={SUB_LABEL}>Bias meter</p>
                <div className="mt-4">
                  <BiasMeter left={25} center={50} right={25} />
                </div>
              </div>
            </div>
          </Panel>

          {/* --------------------------------------------------- COLORS */}
          <Panel label="Colors" className="md:col-span-3 lg:col-span-4">
            <div className="flex flex-col gap-6">
              {COLOR_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className={SUB_LABEL}>{group.title}</p>
                  <div className={cn("mt-3 grid gap-4", group.columns)}>
                    {group.swatches.map((swatch) => (
                      <div key={swatch.token}>
                        <div
                          className="h-14 w-full rounded-md border border-border"
                          style={{
                            background: `var(--color-${swatch.token})`,
                          }}
                        />
                        <p className={cn(COLUMN_LABEL, "mt-2")}>
                          {swatch.name}
                        </p>
                        <p className="text-caption text-text-primary">
                          {swatch.hex}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* ---------------------------------------------------- ICONS */}
          <Panel label="Icons" className="md:col-span-3 lg:col-span-3">
            <div className="grid grid-cols-5 gap-y-6">
              {ICONS.map(({ name, Icon }) => (
                <span
                  key={name}
                  title={name}
                  className="flex items-center justify-center"
                >
                  <Icon
                    size={24}
                    strokeWidth={2}
                    aria-label={name}
                    className="text-text-primary"
                  />
                </span>
              ))}
            </div>
            <p className="mt-8 text-body-sm text-text-secondary">
              Line style <span aria-hidden>·</span> 2px stroke{" "}
              <span aria-hidden>·</span> Rounded caps
            </p>
          </Panel>

          {/* --------------------------------------------- CARD EXAMPLE */}
          <Panel label="Card example" className="md:col-span-6 lg:col-span-5">
            <ArticleCard {...MOCK_ARTICLE} />
          </Panel>

          {/* -------------------------------------------------- SPACING */}
          <Panel
            label="Spacing system"
            note="(4px base unit)"
            className="md:col-span-3 lg:col-span-4"
          >
            <div className="flex items-end gap-4">
              {SPACING_STEPS.map((step) => (
                <div key={step} className="flex flex-col items-center gap-3">
                  <div
                    className="rounded-sm"
                    style={{
                      width: `${step}px`,
                      height: `${step}px`,
                      background: DIAGRAM_FILL,
                    }}
                  />
                  <span className="text-caption text-text-secondary">
                    {step}px
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-body-sm text-text-secondary">
              Consistent spacing scale based on 4px base unit
            </p>
          </Panel>

          {/* ----------------------------------------------------- GRID */}
          <Panel label="Grid system" className="md:col-span-3 lg:col-span-4">
            <div className="flex items-stretch gap-5">
              <div className="grid min-w-0 flex-1 grid-cols-12 gap-1.5">
                {Array.from({ length: 12 }, (_, column) => (
                  <div
                    key={column}
                    className="h-32 rounded-sm"
                    style={{ background: DIAGRAM_FILL }}
                  />
                ))}
              </div>
              <ul className="flex shrink-0 flex-col justify-between">
                {GRID_SPECS.map((spec) => (
                  <li key={spec.label}>
                    <p className="text-caption font-medium text-text-primary">
                      {spec.label}
                    </p>
                    <p className="text-caption text-text-secondary">
                      {spec.value}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          {/* -------------------------------------------------- SHADOWS */}
          <Panel label="Shadows" className="md:col-span-3 lg:col-span-2">
            <div className="flex flex-col gap-5">
              {SHADOWS.map((shadow) => (
                <div key={shadow.name} className="flex items-center gap-4">
                  <div
                    className={cn(
                      "h-10 w-10 shrink-0 rounded-md bg-bg-primary",
                      shadow.className,
                    )}
                  />
                  <div className="min-w-0">
                    <p className={COLUMN_LABEL}>{shadow.name}</p>
                    <p className="text-caption break-words text-text-secondary">
                      {shadow.css}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* -------------------------------------------- BORDER RADIUS */}
          <Panel label="Border radius" className="md:col-span-3 lg:col-span-2">
            <div className="flex flex-col gap-5">
              {RADII.map((radius) => (
                <div key={radius.name} className="flex items-center gap-4">
                  <div
                    className={cn(
                      "h-10 w-10 shrink-0 border border-border bg-bg-primary",
                      radius.className,
                    )}
                  />
                  <div>
                    <p className={COLUMN_LABEL}>{radius.name}</p>
                    <p className="text-caption text-text-secondary">
                      {radius.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* --------------------------------------------------- FOOTER */}
          <footer className="col-span-full rounded-lg bg-text-primary px-6 py-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-5">
                <Logo variant="dark" size="sm" />
                <p className="text-body-sm text-white/70">
                  Balanced news coverage,
                  <br />
                  powered by AI.
                </p>
              </div>

              <div className="flex flex-wrap gap-x-10 gap-y-2 text-body-sm text-white/70">
                <span>{DESIGN_SYSTEM_VERSION}</span>
                <span>{DESIGN_SYSTEM_DATE}</span>
              </div>

              <p className="text-body-sm text-white/70">
                Stay consistent. Stay unbiased.
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
