# Quote form tests

The form on `/contact` and the home page is the only way a customer asks for
work. It is also the one part of this codebase that breaks *silently*: a
submission that no longer reaches the database still renders, still validates
and still clicks. Nothing turns red. The leads just stop, and the ones that were
lost leave no trace to go back to.

`tests/contact-form.spec.ts` is the guard against that.

## Running it

```bash
npm run test:form      # just the form, ~35s
npm run test:smoke     # the whole browser suite
```

The first run needs a browser: `npx playwright install chromium`.

In CI, `.github/workflows/quote-form.yml` runs it on **every** pull request —
deliberately not behind a path filter. A submission touches validation, two
services, the Supabase client, the confirmation screen and an edge function, so
the change that breaks it usually lands somewhere else entirely.

## What it pins

The specs drive the real `ContactForm` in a real browser, mounted by
`tests/harness/contact-form.html`, with Supabase's REST endpoints stubbed and
recorded. Nothing is mocked at the React level, so the validation rules, the
pricing, `createInquiry`, `createSavedRequest` and the confirmation modal are
all the shipped code.

| The promise | Why it matters |
| --- | --- |
| A completed form writes both rows and shows a confirmation code | The lead exists, and the customer has something to quote back |
| The code on screen is the code that was stored | A mismatch strands the customer at request lookup |
| The lead carries every answer given | The classic silent regression is a field quietly dropped from the payload |
| The saved lookup row stores the email normalized | Lookup matches on the normalized address |
| The business is notified | A saved lead nobody is told about is not a lead |
| An incomplete form is refused | A half-filled row is worse than none |
| An unreachable email address is refused | A lead you cannot answer is worth no more than no lead |
| A failed write says so, keeps what was typed, and never shows the success screen | The customer knows to retry or call, instead of waiting on a lead that was never saved |
| A failed write does not print the database error | Policy and table names stay out of the browser |

## Changing the form

If you add a field, add it to `fillEverything` and to the `toMatchObject`
assertion in *the saved lead carries every answer the customer gave*. That
assertion is the point of the suite: it is what fails when a field stops making
it into the database.

The tests were checked against deliberately broken copies of `ContactForm`
before being committed — a dropped `client_phone`, a severed inquiry link, a
relaxed ZIP rule, a permissive email rule and a swallowed submission error each
turned the suite red. A test that cannot fail is not protecting anything, so
re-check that way after changing them.
