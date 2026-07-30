# Tugende — Project Description

## One-line pitch
Share the ride, split the cost. Tugende connects people who are already driving somewhere with people who want to travel the same way.

## The problem
Every day across Uganda, private cars make the same trips half-empty — a commuter driving alone to work, a family driving from Kampala to Mbarara for the weekend — while other people making the exact same journey pay full price for a taxi, bus, or boda. That's wasted capacity on one side and unnecessary cost on the other, and right now there's no simple, trusted way for these two people to find each other.

Uganda has ride-hailing apps (SafeBoda, Bolt, Uber, Little) that connect passengers to professional drivers, and intercity travel is dominated by bus operators and informal taxi parks. Nobody has a working, actively-used product for the space in between: ordinary people, already making a trip, sharing it with someone else going the same way.

A previous attempt at this — SafariShare, launched in 2019 — pivoted through corporate carpooling and then into bus-ticket comparison, and today has no functioning mobile app and almost no public presence, despite Uganda being roughly 95% Android. Its struggles largely map to a uniquely difficult launch window (COVID-era lockdowns, when shared-car travel was actively discouraged) rather than to the underlying idea being unsound.

## The idea
Tugende is **not** a taxi app, and it doesn't recruit professional drivers. It's a peer-to-peer marketplace built on a simple premise: someone is already going somewhere.

**Example:**
> Gerald is driving from Kampala to Mbarara on Saturday. He has 3 empty seats. He posts:
> Kampala → Mbarara, Saturday 8:00 AM, 3 seats, UGX 25,000 per passenger.
>
> Someone searching Kampala → Mbarara finds the trip, requests a seat, and the two coordinate the journey.

The same model applies to daily commuting — someone driving the same direction to work every day can offer seats to others on that route, at a much lower price point (e.g. UGX 2,500 vs. 25,000 for a long-distance trip). Daily commutes are also the stronger starting wedge: the same two people traveling the same route five days a week solves the "is anyone even going my way today" liquidity problem that kills most carpooling products before they can grow.

## Value proposition
- **Going somewhere? Don't drive with empty seats.**
- **Find someone already going your way. Share the ride.**

## Target market
- Phase 1: Daily commuters in and around Kampala (e.g. Ntinda, Kira, Naalya, Entebbe Road corridors) doing repeat, predictable routes.
- Phase 2: Intercity travelers on high-traffic routes (Kampala–Mbarara, Kampala–Gulu, Kampala–Jinja, etc.)
- Long-term: expansion across East Africa.

## Product — core user flows

**Passenger:** register → verify phone → search destination → choose date → view available rides → view driver profile → request seat → pay/book → receive confirmation → contact driver → rate journey

**Driver:** register → verify identity → add vehicle → create trip (departure, destination, date/time, seats, contribution per passenger) → accept/reject requests → view bookings → receive payment → rate passenger

## Trust layer
Trust is core to the product, not an afterthought:
- Verified phone number
- Verified identity
- Verified vehicle
- Driver star rating
- Number of completed trips

This is what turns "an app where strangers get into strangers' cars" into something people actually feel safe using.

## Business model
A wallet is built into the app (tied to the FlowPesa concept), so passengers and drivers pay each other in-app rather than in cash, with Tugende earning a small commission or fee per completed trip.

Planned approach:
1. Start with a flat, small booking fee per confirmed seat (simple, doesn't touch driver earnings, generates real transaction volume early).
2. Consider percentage-based commission later, once trust and volume are established — kept modest, since contributions are framed as cost-sharing, not driver profit (both for user trust and to stay clearly outside taxi/PSV licensing territory).
3. Longer-term option: a "verified pro commuter" subscription or premium placement instead of/alongside commission.

## Legal framing
Tugende positions itself explicitly as a cost-sharing platform, not a transport/taxi service — contributions are capped at a share of fuel and running costs, not a profit margin for drivers, and the platform doesn't employ or dispatch drivers. This mirrors how BlaBlaCar operates globally and is intended to keep the product outside PSV (Public Service Vehicle) licensing requirements that apply to commercial passenger transport.

## Go-to-market
Building in public rather than a traditional launch:
- **Now:** X/Twitter posts — sharing the idea, the problem, and directly asking real people whether they'd offer seats to someone going their way, to validate demand before writing code.
- **Later (once there are real screens to show):** TikTok and Facebook — showing the actual build process day by day, not just polished announcements.

## Differentiation from SafariShare
- Self-serve, consumer-first from day one — no corporate/HR sales motion.
- Mobile-first with an actual Android app (SafariShare currently has none).
- Wallet-native payments baked in from early on, not bolted on later.
- Built and marketed in public, generating an audience before liquidity is needed — rather than launching quietly and hoping for word of mouth.

## Status
Idea validated in concept; not yet built. Current phase: naming, positioning, and public validation of demand via social posts, before committing to MVP scope and build.
