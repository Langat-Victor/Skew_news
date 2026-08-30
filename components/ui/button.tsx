import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "text";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-md px-6 py-2.5 text-body-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bias-right focus-visible:ring-offset-2 disabled:cursor-not-allowed";

/*
  The reference sheet lays buttons out as three rows x four columns
  (Default / Hover / Outline / Disabled). Only the rows are variants:
  - Hover is pure CSS, not a prop.
  - Disabled uses the native attribute.
  - The "Outline" column is the `secondary` variant, which is already outlined.
*/
const VARIANT_BASE: Record<ButtonVariant, string> = {
  primary: "bg-text-primary text-white",
  secondary: "border border-border bg-bg-primary text-text-primary",
  text: "text-text-primary",
};

const VARIANT_HOVER: Record<ButtonVariant, string> = {
  primary: "hover:bg-black",
  secondary: "hover:bg-bg-secondary",
  text: "hover:text-bias-right",
};

const VARIANT_DISABLED: Record<ButtonVariant, string> = {
  primary:
    "disabled:bg-bg-secondary disabled:text-text-secondary/50 disabled:hover:bg-bg-secondary",
  secondary:
    "disabled:text-text-secondary/50 disabled:hover:bg-bg-primary",
  text: "disabled:text-text-secondary/50 disabled:hover:text-text-secondary/50",
};

/**
 * Class string for a button variant. Use this to give a non-`<button>` element
 * (such as `next/link`) button styling without nesting interactive elements.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  className?: string,
): string {
  return cn(
    BASE_CLASSES,
    VARIANT_BASE[variant],
    VARIANT_HOVER[variant],
    VARIANT_DISABLED[variant],
    className,
  );
}

/**
 * Renders a button in its hovered appearance without a pointer, for the design
 * system's "Hover" column. Derived from `VARIANT_HOVER` by dropping the
 * `hover:` prefix, so the preview can never drift from the real hover style.
 */
export function buttonHoverPreviewClasses(variant: ButtonVariant): string {
  return cn(
    BASE_CLASSES,
    VARIANT_BASE[variant],
    VARIANT_HOVER[variant].replaceAll("hover:", ""),
  );
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, className)}
      {...props}
    />
  );
}
