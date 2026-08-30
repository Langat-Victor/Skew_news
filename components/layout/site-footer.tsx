import { Logo } from "@/components/ui/logo";
import { SocialIcon, type SocialIconName } from "@/components/ui/social-icon";

/*
  Dark site footer. Link labels are inert `<span>`s — none of these pages exist
  yet, and a link to a 404 is worse than no link.
  TODO(footer): turn each label into a <Link> as its page ships.
*/
const LINK_COLUMNS: { heading: string; links: string[] }[] = [
  {
    heading: "Company",
    links: ["About", "Careers", "Press", "Contact"],
  },
  {
    heading: "Help",
    links: ["Help Center", "Guides", "Privacy Policy", "Terms of Service"],
  },
];

const SOCIALS: SocialIconName[] = ["x", "linkedin", "instagram", "youtube"];

export function SiteFooter() {
  return (
    <footer className="bg-text-primary">
      <div className="mx-auto max-w-page px-6 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo variant="dark" size="sm" />
            <p className="mt-4 max-w-[15rem] text-body-sm text-white/60">
              Balanced news coverage powered by AI.
            </p>
          </div>

          {LINK_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="mb-3 text-body-sm font-semibold text-white">
                {column.heading}
              </h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link} className="text-body-sm text-white/60">
                    {link}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2 className="mb-3 text-body-sm font-semibold text-white">
              Connect
            </h2>
            <div className="flex gap-4 text-white/60">
              {SOCIALS.map((name) => (
                <SocialIcon key={name} name={name} size={18} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-5 text-caption text-white/50">
          © 2026 SKEW news. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
