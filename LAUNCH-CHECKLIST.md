# Twogende — before launch

Things that are designed, promised in the UI, or half-built, and must be
finished before the app goes out. Kept here rather than in a chat log so it
survives the session it was raised in.

Anything marked **inert** is visible in the app but deliberately does nothing —
never faked, never silently removed.

## Features promised in the UI but not built

- [ ] **In-app calling.** The Call button is in the chat header on both the
      driver and passenger sides, currently **inert**. Needs a voice provider
      (Twilio Voice, Agora or similar), and a decision on whether calls are
      masked — a real phone number must not leak through the call layer after
      all the care taken to keep it out of the API.
- [ ] **Translate this chat.** Designed as a toggle in the chat, currently
      **inert**. Needs a translation service and a decision on whether the
      original text is kept alongside the translation.
- [ ] **"Let us know here"** on the pickup-point notice. No correction flow
      exists behind the link.
- [ ] **Edit a published ride.** The button on the ride-management screen is
      **inert**. `PATCH /trips/{id}` exists (departure, contribution, notes
      only — the route can't be rewritten under someone who already booked),
      but there's no screen for it.

## Half-built

- [ ] **Driver location reporting.** `POST /trips/{trip}/location` works and
      arrival detection is tested, but nothing in the app calls it. Needs a
      background task (`expo-location` `startLocationUpdatesAsync` plus an
      Android foreground service) and its own battery and permission
      conversation.
- [ ] **WhatsApp OTP.** `ChannelRouter` already prefers WhatsApp and falls back
      to SMS; only SMS is registered. Needs a Meta-approved Authentication
      template before it can send anything.
- [ ] **Push notifications.** `push_tokens` table exists. No sender, no
      triggers. "You'll get a notification once accepted" on the ride-requested
      screen is currently a promise nothing keeps.
- [ ] **Identity and vehicle approval.** Submissions land as `pending` and
      nothing approves them. Agreed approach was an artisan command plus dev
      console buttons; neither is written, so no driver can be verified.
- [ ] **Ratings.** Schema and the reputation columns exist; no endpoints, no
      screen. Profiles show "New · No trips yet" forever until this lands.
- [ ] **Auto-complete sweep** for trips a driver forgets to close. Config
      (`trips.auto_complete_after_hours`) exists; the scheduled command doesn't.

## Configuration needed before it works anywhere but this laptop

- [ ] **Google Geocoding API** — not enabled on the Cloud project. Reverse
      geocoding currently answers with a nearby *business* ("African Clean
      Energy Kampala Office") instead of a neighbourhood ("Ntinda"). Search
      still matches on coordinates, so this is a labelling problem, not a
      broken feature. Fix documented in `GooglePlacesProvider::nearest()`.
- [ ] **SMS gateway.** `SMS_DRIVER=dev` writes codes to the dev console. A real
      gateway (Africa's Talking, Twilio) is needed to reach an actual handset.
- [ ] **Production storage.** Identity documents and chat photos are on the
      local private disk. Fine locally; needs real object storage in
      production, still private and still served through the authorised route.
- [ ] **API base URL.** `EXPO_PUBLIC_API_URL` points at a LAN address.

## Decisions still open

- [ ] **Seat pill colour rule.** Three mockups show 2 and 4 seats in acacia,
      3 in ochre, 1 in acacia *and* neutral. No consistent rule, so everything
      renders acacia.
- [ ] **`passenger_seats` on the vehicle step.** Not in the verification
      design, but a trip can't be published without it. Defaults to 4.
- [ ] **Estimated arrival time.** Two designs show one; nothing in the schema
      knows it, and a guessed ETA on Kampala roads is worse than none.
- [ ] **Full number plate.** The verification screen promises passengers never
      see it; two later designs show one. Currently only the last four
      characters are collected or shown anywhere.
- [ ] **"Price" vs "Contribution"** in UI copy. The database and API say
      contribution throughout, for the PSV positioning. One design says
      "Price per seat".

## Before the store

- [ ] Nothing is committed. The repository still has zero commits.
- [ ] Android package name is still `com.placeholder.appid`.
- [ ] A development build is needed for anything that can't run in Expo Go.
