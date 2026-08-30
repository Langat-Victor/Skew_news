import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
  Our typography tokens (text-h1, text-body-md, …) are not t-shirt sizes, so
  stock tailwind-merge classifies them as text *colors* and would drop
  `text-h3` when it is combined with `text-text-secondary`. Registering them
  under font-size keeps size and color as independent, mergeable concerns.
*/
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "h1",
            "h2",
            "h3",
            "h4",
            "body-lg",
            "body-md",
            "body-sm",
            "caption",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
