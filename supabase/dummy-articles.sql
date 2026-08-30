-- ============================================================================
-- SKEW news — DUMMY articles + analyses for local UI testing
--
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → New query → paste this whole
-- file → Run. Requires supabase/schema.sql and supabase/seed.sql first (the
-- five sources are looked up by name).
--
-- Re-runnable: `on conflict do nothing` on both inserts.
--
-- REMOVE IT ALL when you are done — the last statement in this file, commented
-- out, deletes exactly these nine rows (analyses cascade).
--
-- THIS IS FABRICATED DATA. Every headline, body, author, and analysis below is
-- invented for layout testing: the places, agencies, and companies do not
-- exist, and the numbers are not a real model's output. It is attached to real
-- outlet names only because `articles.source_id` must reference a seeded source.
-- The stored disclaimer and `model = 'dummy-fixture-v1'` say so in the UI too.
-- Never run this against a production project.
--
-- ABOUT THE IMAGES: `image_url` points at a host that is NOT in
-- lib/news/image-hosts.ts, so `isOptimizableImageUrl` rejects it and each card
-- renders category-coded `PlaceholderArt` instead. That is deliberate — a real
-- CDN path would either rot or 404 through `/_next/image`. To see real photos,
-- add a host to IMAGE_HOSTS, restart `next dev`, and update these URLs.
--
-- WHAT IT EXERCISES: a 3×3 feed grid, two date labels, all five sources, all
-- five bias labels, all three sentiment labels, a Related Stories rail
-- (Politics ×3, World ×2, Technology ×2) and two categories with no rail at all
-- (Climate, Health), one article with no author, and one with no country.
-- ============================================================================

-- --------------------------------------------------------------- articles ---
insert into public.articles (
  source_id, original_url, canonical_url, slug, title, image_url,
  published_at, raw_text, category, country, author, scraped_at, analyzed_at
)
select
  s.id,
  v.original_url,
  v.original_url,
  v.slug,
  v.title,
  -- NOT a leftover from the SKEW news rebrand: this path is a DATA KEY, not
  -- branding. It is already stored in `image_url` on the rows this file created,
  -- and both the verification query and the cleanup DELETE below match on it.
  -- Renaming it would leave that DELETE unable to remove its own rows.
  'https://cdn.example.com/biasly-dummy/' || v.slug || '.jpg',
  now() - v.age,
  v.raw_text,
  v.category,
  v.country,
  v.author,
  now(),
  -- Set: the feed only shows analysed articles. The analysis row below is what
  -- actually makes them displayable (§19.1).
  now()
from (values

  ('Reuters',
   'https://www.reuters.com/world/us/senate-panel-advances-grant-reporting-overhaul-2026-08-24/',
   'senate-panel-advances-grant-reporting-overhaul-a1f4c2',
   'Senate panel advances bill to overhaul federal grant reporting',
   interval '3 hours',
   $txt$A Senate oversight panel voted 11-7 on Monday to advance a bill that would require every federal grant over one million dollars to publish quarterly spending reports in a single public format. Supporters called the current patchwork of agency portals unusable for anyone outside government.

The measure would give agencies eighteen months to migrate, with a two-year extension available for programmes that share data with state partners. A budget office estimate put the transition cost at forty-one million dollars, most of it in the first year.

Two members who voted against the bill said the deadline ignores how thinly staffed smaller grant offices already are. The panel chair said the schedule would not move, and that the committee expects a floor vote before the autumn recess.$txt$,
   'Politics', 'United States', 'Marta Kelleher'),

  ('Fox News',
   'https://www.foxnews.com/politics/governors-push-back-federal-permitting-timeline',
   'governors-push-back-federal-permitting-timeline-7b3e91',
   'Governors push back on new federal permitting timeline',
   interval '7 hours',
   $txt$Nine governors signed a joint letter this week objecting to a federal permitting timeline that would put a hard ninety-day cap on state environmental review for projects drawing federal funds. The letter calls the cap unworkable for states that run their own hearings.

The agency behind the rule says the cap only applies to the federal portion of a review and that states remain free to run longer processes on their own authority. Three of the signing governors dispute that reading, arguing the funding condition makes the cap effectively binding.

A comment period closes next month. Two states have already said they will sue if the rule is finalised as written, and a coalition of construction trade groups has filed in support of it.$txt$,
   'Politics', 'United States', 'Dale Ruthven'),

  ('NPR',
   'https://www.npr.org/2026/08/25/1284455901/northvale-ranked-choice-ballot-first-test',
   'northvale-ranked-choice-ballot-first-test-4c8d05',
   'Northvale''s ranked-choice ballot faces its first real test',
   interval '11 hours',
   $txt$Northvale switched to ranked-choice voting two years ago and has never had a contest close enough to need it. Next week it will: five candidates are running for a council seat and no poll has anyone near a majority.

Election staff have spent the summer on the part voters never see. Ballots are counted centrally, rounds are published one at a time, and a public tabulation is scheduled for the morning after the polls close so observers can watch eliminations happen in order.

Turnout in the last municipal cycle was twenty-two percent. Organisers running door-to-door explainers say the ranking itself has not been the hard part to teach; the harder question is why a second choice matters at all when a favourite is already on the ballot.$txt$,
   'Politics', 'United States', 'Priya Anand'),

  ('BBC News',
   'https://www.bbc.com/news/articles/c3n8xk2q0dlo',
   'meridian-bay-port-strike-second-week-92ab13',
   'Port strike in Meridian Bay enters a second week',
   interval '5 hours',
   $txt$Cranes at Meridian Bay have been still for eight days. Around 1,400 dockworkers walked out over a rostering change that shifted night shifts onto a rolling schedule, and talks broke off on Friday with no date set to resume.

The port handles roughly a fifth of the region's container traffic. Two shipping lines have begun diverting to a smaller terminal ninety kilometres north, which has added days to inland delivery and, according to one freight operator, tripled short-haul trucking costs on the route.

The port authority says the rostering change is needed to keep berths open overnight and that pay is not on the table. The union says it will not return to talks until the rolling schedule is withdrawn. A mediator appointed on Tuesday has met each side separately.$txt$,
   'World', 'United Kingdom', 'Tom Fairweather'),

  ('The Guardian',
   'https://www.theguardian.com/global-development/2026/aug/25/loruk-drought-insurance-early-payout',
   'loruk-drought-insurance-early-payout-51fd7e',
   'Drought insurance scheme pays out early for herders in Loruk',
   interval '20 hours',
   $txt$A livestock insurance scheme in Loruk released payments in July this year rather than waiting for the end of the dry season, after satellite vegetation readings crossed a trigger threshold six weeks earlier than usual.

The timing matters more than the amount. Herders who receive money while animals are still alive buy feed and water; those paid after a die-off are buying replacement stock at the worst possible price. About 4,000 households were covered this cycle.

Scheme administrators say the early trigger cost the fund more than a normal year and that the model will need recalibrating if early releases become routine. Two neighbouring counties have asked to join, which would roughly double the covered area without doubling the fund.$txt$,
   'World', 'Kenya', null),

  ('Reuters',
   'https://www.reuters.com/technology/vireo-labs-delays-next-fab-2026-08-26/',
   'vireo-labs-delays-next-fab-two-quarters-6de204',
   'Chipmaker Vireo Labs delays its next fab by two quarters',
   interval '1 hour',
   $txt$Vireo Labs told investors on Tuesday that its next fabrication plant will not begin volume production until the third quarter of next year, two quarters later than the schedule it gave in February. The company blamed tool delivery slippage rather than demand.

Executives said the delay does not change the plant's total capacity or its capital budget, and that three of the four tool suppliers have confirmed revised dates. The fourth, which supplies lithography equipment, has not.

Analysts on the call pressed on what happens to customers who signed capacity agreements tied to the original schedule. The chief executive said those contracts have flexibility windows and that no customer has asked to renegotiate. Shares fell in after-hours trading before recovering part of the loss.$txt$,
   'Technology', 'United States', 'Aiko Tanaka'),

  ('BBC News',
   'https://www.bbc.com/news/articles/cx9w2m5v7p3o',
   'schools-trial-offline-homework-assistant-b81c46',
   'Schools trial an offline homework assistant to cut data worries',
   interval '30 hours',
   $txt$Forty secondary schools are trialling a homework assistant that runs entirely on classroom hardware, with no student text leaving the building. The trade-off is a smaller, slower model than the cloud tools some pupils already use at home.

Teachers in the trial report the offline tool is noticeably worse at long explanations and noticeably better at staying on task, because it cannot wander into anything outside the loaded course material. Two schools have asked for a way to add their own past papers.

The programme is funded through next summer. Its evaluation will look at whether pupils use it at all once they realise it is weaker than what is on their phones, which the lead researcher describes as the trial's real question.$txt$,
   'Technology', 'United Kingdom', 'Nadia Okonjo'),

  ('The Guardian',
   'https://www.theguardian.com/environment/2026/aug/24/grantham-basin-water-plan',
   'grantham-basin-water-plan-splits-towns-2f70bd',
   'Grantham Basin water plan splits farmers and river towns',
   interval '2 days',
   $txt$A draft allocation plan for the Grantham Basin would cut irrigation entitlements by twelve percent in dry years and hold the difference for environmental flows. Irrigators say the cut lands hardest on the growers with the least storage; river towns downstream say it is overdue.

The basin authority modelled four scenarios and published all of them, which is new. The scenario chosen is not the one that keeps the most water in the river, nor the one that protects the most entitlements — a middle option the authority describes as the only one it could defend at either end.

Consultation runs for ten weeks, with hearings in six towns. One irrigator group has already commissioned its own hydrology review, and two councils have voted to support the draft as published.$txt$,
   'Climate', 'Australia', 'Ruth Callaghan'),

  ('NPR',
   'https://www.npr.org/2026/08/23/1284401755/rural-clinics-shared-staffing-pilot',
   'rural-clinics-shorter-waits-shared-staffing-d34a87',
   'Rural clinics report shorter waits after a shared-staffing pilot',
   interval '3 days',
   $txt$Eleven rural clinics that pooled specialist hours instead of each hiring their own report median waits falling from thirty-one days to nineteen over the pilot's first year. Specialists rotate on a fixed weekly schedule rather than travelling on request.

The clinics also found something they had not measured before: how many appointments were being lost to travel. Patients who previously drove two hours for a fifteen-minute follow-up now do most of those visits locally, and the no-show rate dropped by roughly a third.

Whether the arrangement survives depends on funding that ends in June. Two of the eleven clinics have said they will hire independently if the pool lapses, which administrators warn would pull hours out of the schedule the other nine depend on.$txt$,
   'Health', null, 'Gabriel Ortiz')

) as v(source_name, original_url, slug, title, age, raw_text, category, country, author)
join public.sources s on s.name = v.source_name
on conflict (original_url) do nothing;

-- -------------------------------------------------------------- analyses ---
-- `bias_score` is absent on purpose: the database generates it as
-- (right_percentage − left_percentage) / 100 (§19).
insert into public.article_analyses (
  article_id, summary, sentiment_score, sentiment_label,
  left_percentage, center_percentage, right_percentage,
  bias_label, confidence, framing_notes, loaded_terms, disclaimer, model
)
select
  a.id,
  v.summary,
  v.sentiment_score,
  v.sentiment_label,
  v.left_pct,
  v.center_pct,
  v.right_pct,
  v.bias_label,
  v.confidence,
  v.framing_notes,
  v.loaded_terms,
  'AI-estimated analysis of fabricated sample data. Not objective truth, and not a real article.',
  'dummy-fixture-v1'
from (values

  ('senate-panel-advances-grant-reporting-overhaul-a1f4c2',
   'A Senate oversight panel advanced a bill requiring quarterly public spending reports for federal grants above one million dollars, in a single shared format. Agencies would have eighteen months to migrate, with an extension for programmes sharing data with states. Dissenting members cited staffing; the chair kept the deadline.',
   0.05, 'neutral', 34, 44, 22, 'center', 0.78,
   'Both the vote count and the dissent are reported without adjectives, and the cost estimate is attributed to the budget office rather than to either side.',
   array['overhaul', 'unusable', 'patchwork']),

  ('governors-push-back-federal-permitting-timeline-7b3e91',
   'Nine governors objected in a joint letter to a proposed ninety-day federal cap on state environmental review for federally funded projects. The issuing agency says the cap covers only the federal portion; several governors argue the funding condition makes it binding in practice. Two states have threatened litigation.',
   -0.34, 'negative', 12, 30, 58, 'right', 0.71,
   'Leads with the objection and returns to it after the agency''s response, so the federal position is framed as a rebuttal rather than as the starting point.',
   array['push back', 'unworkable', 'hard cap']),

  ('northvale-ranked-choice-ballot-first-test-4c8d05',
   'Northvale will use its ranked-choice system in a genuinely close race for the first time, with five council candidates and no clear majority in polling. Officials will publish elimination rounds one at a time the morning after polls close. Turnout in the last municipal cycle was twenty-two percent.',
   0.22, 'positive', 46, 38, 16, 'left', 0.64,
   'Treats the mechanics as a civic-access story and gives most of its space to the officials and organisers running it, with no critic of ranked-choice voting quoted.',
   array['first real test', 'explainers']),

  ('meridian-bay-port-strike-second-week-92ab13',
   'A strike by around 1,400 dockworkers at Meridian Bay reached its eighth day over a rolling night-shift roster, with talks stalled. Two shipping lines have diverted to a smaller terminal, raising inland delivery times and short-haul costs. The port authority says pay is not in dispute; the union wants the roster withdrawn.',
   -0.41, 'negative', 30, 52, 18, 'center', 0.80,
   'Gives the authority and the union the same amount of space and closes on the mediator, but the economic consequences are described in more concrete detail than either side''s position.',
   array['still', 'broke off', 'tripled']),

  ('loruk-drought-insurance-early-payout-51fd7e',
   'A livestock insurance scheme in Loruk paid out six weeks early after satellite vegetation readings crossed a trigger threshold, covering about 4,000 households. Administrators say early payment lets herders buy feed rather than replacement animals, but that the model needs recalibrating if early triggers recur. Two counties have asked to join.',
   0.31, 'positive', 44, 42, 14, 'mixed', 0.58,
   'Frames the scheme as working while quoting its administrators on the cost of that outcome, so the sympathetic and sceptical readings sit almost evenly.',
   array['matters more', 'worst possible price']),

  ('vireo-labs-delays-next-fab-two-quarters-6de204',
   'Vireo Labs pushed volume production at its next fabrication plant to the third quarter of next year, two quarters later than its February guidance, citing tool delivery slippage rather than demand. Three of four tool suppliers have confirmed revised dates; the lithography supplier has not. Shares fell after hours before partly recovering.',
   -0.28, 'negative', 20, 62, 18, 'center', 0.85,
   'Reports the company''s explanation and the unresolved supplier gap side by side, and attributes the capacity and budget claims to executives rather than stating them directly.',
   array['slippage', 'flexibility windows']),

  ('schools-trial-offline-homework-assistant-b81c46',
   'Forty secondary schools are trialling a homework assistant that runs on local hardware so no student text leaves the building, at the cost of a smaller and slower model. Teachers report weaker explanations but better focus. The evaluation''s central question is whether pupils use a tool they know is weaker than their phones.',
   0.18, 'positive', 28, 55, 17, 'center', 0.66,
   'States the trade-off in the second sentence and lets the lead researcher name the trial''s weakest point, which keeps the framing closer to evaluation than to promotion.',
   array['data worries', 'wander']),

  ('grantham-basin-water-plan-splits-towns-2f70bd',
   'A draft Grantham Basin allocation plan would cut dry-year irrigation entitlements by twelve percent and hold the water for environmental flows. Irrigators say growers with the least storage are hit hardest; downstream towns call it overdue. The authority published all four modelled scenarios and chose a middle option. Consultation runs ten weeks.',
   -0.22, 'negative', 41, 39, 20, 'mixed', 0.61,
   'Named both constituencies in the headline and gives each a paragraph, but the environmental case is carried by the authority''s own reasoning rather than by a quoted advocate.',
   array['splits', 'lands hardest', 'overdue']),

  ('rural-clinics-shorter-waits-shared-staffing-d34a87',
   'Eleven rural clinics that pooled specialist hours cut median waits from thirty-one days to nineteen in the pilot''s first year, and saw no-shows fall by about a third as patients avoided long drives. Funding ends in June; two clinics say they would hire independently, which administrators warn would undercut the shared schedule.',
   0.44, 'positive', 35, 50, 15, 'center', 0.74,
   'Leads with the measured improvement and only then the funding cliff, so the pilot is framed as a success under threat rather than as an unresolved question.',
   array['lost to travel', 'lapses'])

) as v(slug, summary, sentiment_score, sentiment_label,
       left_pct, center_pct, right_pct, bias_label, confidence,
       framing_notes, loaded_terms)
join public.articles a on a.slug = v.slug
on conflict (article_id) do nothing;

-- ------------------------------------------------------------------ checks --
-- Nine rows, newest first, with the generated bias_score.
select a.slug, s.name as source, a.category, an.bias_label, an.bias_score,
       an.sentiment_label, an.confidence, a.published_at
from public.articles a
join public.sources s on s.id = a.source_id
join public.article_analyses an on an.article_id = a.id
where a.image_url like 'https://cdn.example.com/biasly-dummy/%'
order by a.published_at desc;

-- Must be empty: every dummy article has an analysis row (§19.1).
-- select slug, title from public.articles_pending_analysis;

-- ----------------------------------------------------------------- cleanup --
-- Uncomment and run to remove every row this file inserted. The analyses
-- cascade with the articles.
-- delete from public.articles
--  where image_url like 'https://cdn.example.com/biasly-dummy/%';
