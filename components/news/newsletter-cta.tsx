import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NewsletterCtaProps {
  className?: string;
}

/*
  Signup band under the article. The email field is a styled `<div>`, not an
  `<input>`: there is no subscribe endpoint yet, and a field the reader can type
  their address into that silently discards it is worse than an obvious
  placeholder. Both halves stay out of the tab order until the form is real.
  TODO(newsletter): swap in a form + POST handler once the list exists.
*/
export function NewsletterCta({ className }: NewsletterCtaProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-bg-primary p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-h4 font-semibold text-text-primary">
            Stay Informed. Stay Balanced.
          </h2>
          <p className="mt-1 text-body-sm text-text-secondary">
            Get the top stories and bias analysis delivered to your inbox.
          </p>
        </div>

        <div aria-hidden className="flex flex-col gap-3 sm:flex-row">
          <div className="w-full rounded-md border border-border px-4 py-2.5 text-body-md text-text-secondary md:w-80">
            Enter your email
          </div>
          <span className={buttonClasses("primary")}>Subscribe</span>
        </div>
      </div>
    </section>
  );
}
