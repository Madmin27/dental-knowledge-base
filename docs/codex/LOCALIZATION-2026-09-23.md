# English-first UI — 2026-09-23

The atlas, independent tooth-interior specimen, project page and private
contribution tracking page now offer English and Turkish. English is the default;
an explicit `lang` query overrides the saved site-wide language cookie. The
language switch preserves URL query parameters and private tracking fragments.

Static HTML and interactive labels share an explicit local translation catalog.
Tooth names/search, tissue controls, source explanations, accessibility labels,
errors, contribution forms, statuses and dates follow the selected language.
No external translation service is called. Contributor prose, evidence URLs,
source identifiers, model geometry and persisted review/view records are unchanged.

Verification:

- 72 automated tests passed, including three localization tests covering default,
  query/cookie precedence, invalid input, source/identifier preservation and all
  current HTML routes.
- 5 English/Turkish browser checks passed, including anatomical search, language
  switching, cross-page persistence and 360/390/768/1024px layouts.
- 7 isolated English contribution checks passed: submission, private receipt,
  safe text rendering, contributor update, moderator triage, exact view replay
  and mobile form. Synthetic records were stored only under `/tmp`.
- 12 existing Turkish studio browser checks passed, including keyboard controls,
  themes, fullscreen, help, context-loss recovery and interior/project pages.
- Inspected the English atlas screenshot. The new selector initially caused
  tablet header overflow; the responsive breakpoint was corrected and retested.

Only `dental-preview.service` was restarted. HTTPS health, English/Turkish HTML,
language headers and cookie-based Turkish navigation were verified through
`https://dentalopensource.org`. The user separately confirmed external access.
No DNS, Nginx, TLS or database configuration changes were needed for this release.

These checks establish UI behavior, not expert approval of anatomical terminology
or the underlying models. Expert review remains a separate step.
