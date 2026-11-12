# Twogende - before launch

Things that are designed, promised in the UI, or half-built, and must be
finished before the app goes out. Kept here rather than in a chat log so it
survives the session it was raised in.

Anything marked **inert** is visible in the app but deliberately does nothing - never faked, never silently removed.

## Ship-stoppers - the app does not function without these

- [ ] **No driver can ever be verified, so no trip can ever be published.**
      `canDrive()` requires `identity_verified_at` *and* an approved vehicle.
      Nothing in `app/`, `database/seeders/`, or even the dev console sets
      either one - only test factories do. In production every account is a
      passenger forever, the search screen has nothing to find, and there is
      no marketplace. This is the single biggest blocker on this list.

      Needs an approval path: an artisan command at minimum, an admin screen
      properly.
- [x] **Starting and completing a trip.** ~~Nothing in the app called them.~~
      Done: the live status banner on the driver's ride screen carries the
      action - "Start trip" once the departure time has passed, "Finish" while
      under way, nothing before or after. Finishing confirms first (it closes
      the ride for everyone and fixes the commission), then lands the driver on
      the earnings summary. Verified end to end against the API: start moves a
      passenger's tracking to `en_route`, finish unlocks payment, both rating
      screens and the summary, and the driver's reputation moves.
- [ ] **Nobody is prompted to rate.** Both Trip Complete screens exist and the
      sealed "they rated you" card gives a reason to open them, but nothing
      tells anyone a rating is waiting. Needs push notifications, which are
      also on this list.
- [ ] **Auto-complete sweep** for trips a driver forgets to close. Config
      (`trips.auto_complete_after_hours`) exists; the scheduled command doesn't.

## Money

- [ ] **Mobile money is not connected.** The payment screen offers MTN Mobile
      Money and Airtel Money exactly as designed, and the whole flow behind
      them is built and tested - request, awaiting approval, provider
      callback, failure. What is missing is an aggregator. `MobileMoneyGateway`
      is bound to `UnavailableGateway`, which reports every provider
      unreachable, so choosing one and pressing "Send payment request" says so
      and charges nothing. Cash works end to end.

      Needs: an aggregator (FlowPesa), a webhook route for the callback that
      completes a payment, and IP or signature verification on it - that
      endpoint is the one place where an unauthenticated request can mark
      money as received.
- [ ] **"I approved it" is not on the waiting step.** The design offers it;
      it was left out. A passenger tapping a button is not the provider saying
      money moved, and honouring it would make every ride free. The screen
      polls instead. If you want the button back it can be a "check now"
      that forces a poll - say the word and it goes in.
- [ ] **No receipt survives the moment.** A completed payment has a reference
      (`TWG-8H2K41`) and it is shown once, on the "Payment sent" step. There is
      no payment history anywhere, for either side.
- [ ] **The 20% commission is informational.** `PLATFORM_COMMISSION_RATE`
      decides what the end-of-trip screen shows and is snapshotted onto each
      booking at completion, but nothing settles: passengers pay the driver in
      cash and Twogende collects nothing. The screen says "Paid in cash" for
      exactly that reason. Real collection waits on the wallet (FlowPesa).
- [ ] **No receipt anywhere.** A driver can see the split on the trip they
      just finished and nowhere else - no earnings history, no statement, no
      total. Fine for now; the first driver who asks "how much did I make this
      month?" ends it.

## Legal copy that describes things we have not built

The Settings screen ships a privacy policy and a Play Store Data safety
declaration. Both are statements of fact - one under the Data Protection and
Privacy Act, 2019, the other filed with Google. Each line below is currently
false, and shipping them as written is a real exposure, not a tidiness issue.

- [ ] **Nothing deletes anything on a schedule.** There are no scheduled
      commands at all. The copy promises: selfies erased 24 hours after a
      verification decision, precise location erased 90 days after a trip,
      chat messages after 12 months, identity documents within 30 days of
      account deletion. None of that runs. Four retention jobs plus a
      scheduler entry would make all four statements true.
- [ ] **"Encrypted at rest in Nairobi region storage."** Documents are on the
      local private disk of whichever machine runs the API. Same item as
      "Production storage" below, but the privacy policy now depends on it.
- [ ] **"Visible only to the two-person verification team."** There is no
      verification team and nothing approves documents - submissions sit as
      `pending` for ever. See "Identity and vehicle approval".
- [ ] **"Letting a matched driver and passenger call each other."** In-app
      calling is **inert**.
- [ ] **"Mobile money transactions pass the payer number to MTN or Airtel."**
      No gateway is connected, so nothing is passed to anyone.
- [ ] **Company details are placeholders.** "Twogende Ltd, Plot 14 Bukoto
      Street", +256 200 900 118, privacy@twogende.ug, legal@twogende.ug and
      the 12 August 2026 dates all need to be real before filing.

## Admin dashboard - settings it must own

- [ ] **Commission rate.** `PLATFORM_COMMISSION_RATE` decides the fee taken at
      completion, the percentage on the driver's earnings summary, and the
      percentage printed in Terms §3. The app reads it from `GET /config` so
      all three always agree; the dashboard needs to be able to change it.
      **The rate itself is still undecided** - the Terms were written saying
      12%, the config says 20%.
- [ ] **Support and privacy email addresses**, same reason: quoted in the
      legal copy, served from config.
- [ ] Identity and vehicle approval queues, which is the same item as
      "Identity and vehicle approval" above.

## Configuration needed before it works anywhere but this laptop

- [ ] **Google Maps SDK and Directions API** - neither enabled. Needed for a
      live map and a road-based ETA on the tracking screen. Maps SDK keys are
      per-platform; Directions is billed per request, so cache aggressively or
      only call it when a driver's position moves meaningfully.
- [ ] **Google Geocoding API** - not enabled on the Cloud project. Reverse
      geocoding currently answers with a nearby *business* ("African Clean
      Energy Kampala Office") instead of a neighbourhood ("Ntinda"). Search
      still matches on coordinates, so this is a labelling problem, not a
      broken feature. Fix documented in `GooglePlacesProvider::nearest()`.
- [ ] **SMS gateway - Africa's Talking.** The driver is written and tested
      (`AfricasTalkingSmsSender`, `SMS_DRIVER=africastalking`). It handles the
      quiet failure properly: the API answers 201 and still refuses a message
      when the account is empty or the sender ID is unapproved, so recipient
      status codes are checked, not just the HTTP status. A refusal throws,
      which makes `ChannelRouter` fall through and the API answer 502 rather
      than recording a code nobody will receive.

      Still needed, and none of it is code:
      - An Africa's Talking account, then `AT_USERNAME` and `AT_API_KEY`.
      - Credit on the account. An empty balance fails as status 405.
      - Leave `AT_SENDER_ID` blank until Africa's Talking approve an
        alphanumeric sender ID for the account - an unapproved one is
        rejected (402), it does not fall back to the shared short code.
        Until then messages arrive from a shared number, not "Twogende".
      - `AT_SANDBOX=true` to test the wiring without sending or paying;
        the sandbox is a different host and its username is literally
        "sandbox". Flip to false only when a real code should reach a phone.
- [ ] **Production storage.** Identity documents and chat photos are on the
      local private disk. Fine locally; needs real object storage in
      production, still private and still served through the authorised route.
- [ ] **API base URL.** `EXPO_PUBLIC_API_URL` points at a LAN address.

## Operations, once it is live

- [ ] **No error tracking, uptime monitoring or alerting.** A crash in
      production would be invisible.
- [ ] **No database backups.**
- [ ] **No queue worker and no scheduler running.** `QUEUE_CONNECTION=database`
      but nothing dispatches jobs, and `php artisan schedule:list` reports no
      tasks - so the auto-complete sweep below has nothing to run it.
- [ ] **Production environment not provisioned.** `APP_ENV=local`,
      `APP_DEBUG=true`, `APP_URL=http://localhost`. Debug must be off before
      anything is public - it leaks stack traces and configuration.

## Decisions still open

- [ ] **Rating tag ordering.** The screen shows six chips before "More", and
      which six is a hand-picked `rank` in `RatingTags`. Once there is real
      usage it should be whichever tags people actually tap.
- [ ] **Seat pill colour rule.** Three mockups show 2 and 4 seats in acacia,
      3 in ochre, 1 in acacia *and* neutral. No consistent rule, so everything
      renders acacia.
- [ ] **`passenger_seats` on the vehicle step.** Not in the verification
      design, but a trip can't be published without it. Defaults to 4.
- [ ] **Estimated arrival time.** Two designs show an arrival time for the
      *journey*; nothing in the schema knows one, and a guessed ETA on Kampala
      roads is worse than none. Trip cards and the ride-posted screen show
      departure only.

      Separately, the tracking screen's "6 min" - minutes until the driver
      reaches the *pickup point* - is real but approximate: straight-line
      distance at an assumed 25 km/h, shown only once the driver is sharing a
      fresh position. The Directions API would make it a road estimate.
- [ ] **Full number plate.** The verification screen promises passengers never
      see it; two later designs show one. Currently only the last four
      characters are collected or shown anywhere.
- [ ] **"Price" vs "Contribution"** in UI copy. The database and API say
      contribution throughout, for the PSV positioning. One design says
      "Price per seat".

## Before the store

- [ ] Nothing is committed since the first commit.
- [ ] Android package name is still `com.placeholder.appid`.
- [ ] A development build is needed for anything that can't run in Expo Go.
