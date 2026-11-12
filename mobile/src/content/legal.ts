/**
 * The text of the privacy policy, the terms, and the Play Store data safety
 * declaration.
 *
 * Kept out of the screen because it is the longest content in the app and
 * because it is the part a lawyer reads. Editing wording here should never
 * mean touching a component.
 *
 * The commission rate is a placeholder - `{fee}` - filled from the platform
 * config at render time. It appears in the Terms, on the earnings summary and
 * in the fee actually taken; typed into all three it drifts, and a Terms page
 * quoting a percentage the app does not charge is what gets read out in a
 * dispute. When the admin dashboard can change the rate, this text follows it.
 */

export type LegalSection = { heading: string; paras: string[] };

export type LegalDoc = {
  title: string;
  kicker: string;
  intro: string;
  sections: LegalSection[];
};

export const PRIVACY: LegalDoc = {
  title: "Privacy policy",
  kicker: "Last updated 12 August 2026",
  intro:
    "Twogende Ltd, Plot 14 Bukoto Street, Kampala, operates this carpooling service. This policy explains what we hold about you and what you can demand of us under the Data Protection and Privacy Act, 2019.",
  sections: [
    {
      heading: "1. What we collect",
      paras: [
        "Account data: your name, phone number, profile photo and the language you use the app in.",
        "Verification data: a photograph of your National ID or driving permit, and a selfie taken in the app, used only to confirm you are the person on the document.",
        "Trip data: the pick-up and drop-off points you type, your precise location while a ride is active, and the routes you publish as a driver.",
        "Payment data: the mobile money number you pay from and the amount and reference of each transaction. We never see or store your mobile money PIN - it is entered on your SIM toolkit, outside Twogende.",
      ],
    },
    {
      heading: "2. Why we use it",
      paras: [
        "To match passengers with drivers, to show both parties who they are travelling with, to settle contributions, and to investigate safety reports. We do not build advertising profiles and we do not sell data.",
      ],
    },
    {
      heading: "3. Precise location",
      paras: [
        "Location is read only while a ride is active and while the app is in the foreground. It is shown to the other party on that ride and is deleted 90 days after the trip ends. You can revoke the permission in your phone settings; the app still works, but live tracking and arrival alerts stop.",
      ],
    },
    {
      heading: "4. How long we keep it",
      paras: [
        "Identity documents: until you delete your account, then erased within 30 days.",
        "Trip and payment records: 1 year, for tax and dispute resolution.",
        "Chat messages: 12 months after the trip.",
      ],
    },
    {
      heading: "5. Your rights",
      paras: [
        "You may ask us for a copy of everything we hold, correct anything wrong, or delete your account outright from Settings. Write to {privacyEmail} and we answer within 14 days. You may also complain to the Personal Data Protection Office of Uganda.",
      ],
    },
    {
      heading: "6. Children",
      paras: [
        "Twogende is not for anyone under 18. Accounts we find belonging to minors are closed and their data erased.",
      ],
    },
    {
      heading: "7. Contact",
      paras: [
        "{privacyEmail} · +256 200 900 118 · Plot 14 Bukoto Street, Kampala.",
      ],
    },
  ],
};

export const TERMS: LegalDoc = {
  title: "Terms of service",
  kicker: "Effective 12 August 2026",
  intro:
    "By creating a Twogende account you agree to these terms. Read them - they set out what we are responsible for and, just as importantly, what we are not.",
  sections: [
    {
      heading: "1. What Twogende is",
      paras: [
        "Twogende is a place where people already making a journey can offer their spare seats, and where people travelling the same way can ask for one. We are not a taxi company. We do not employ drivers, own vehicles, or set contributions. The agreement to travel is between the driver and the passenger.",
      ],
    },
    {
      heading: "2. Cost sharing, not profit",
      paras: [
        "Drivers may only ask for a contribution towards fuel, tolls and wear. Contributions that turn a profit make you a commercial operator under Ugandan transport law, and we will remove the listing and may close the account.",
      ],
    },
    {
      heading: "3. Our fee",
      paras: [
        "Twogende takes {fee} of each completed ride from the driver’s earnings. The passenger pays exactly the contribution shown on the ride - nothing is added on top.",
      ],
    },
    {
      heading: "4. Your obligations",
      paras: [
        "Drivers must hold a valid driving permit, third-party insurance and a roadworthy vehicle, and must complete ID verification before publishing a ride.",
        "Passengers must arrive at the agreed pick-up point on time and pay the agreed contribution.",
        "Both parties must behave respectfully. Harassment, intoxication, weapons and carrying goods for trade are grounds for immediate removal.",
      ],
    },
    {
      heading: "5. Cancellations",
      paras: [
        "Either party can cancel from the ride screen. Cancelling within 2 hours of departure repeatedly will lower your reliability score and may suspend your ability to book.",
      ],
    },
    {
      heading: "6. Liability",
      paras: [
        "Twogende does not insure your journey. Any accident, loss, injury or damage during a ride is a matter between the driver, the passenger and the driver’s insurer. Our liability is limited to the fees you paid us in the 12 months before the claim.",
      ],
    },
    {
      heading: "7. Suspension",
      paras: [
        "We may suspend or close an account for fraud, false documents, unsafe driving, or repeated reports from other users. Serious matters are reported to the Uganda Police Force.",
      ],
    },
    {
      heading: "8. Governing law",
      paras: [
        "These terms are governed by the laws of Uganda, and the courts of Uganda have exclusive jurisdiction. Questions: {supportEmail}.",
      ],
    },
  ],
};

export type DataCategory = {
  name: string;
  shared: boolean;
  purpose: string;
  storage: string;
  retention: string;
  required: string;
};

/** The six categories, in the order the Data safety form asks for them. */
export const DATA_CATEGORIES: DataCategory[] = [
  {
    name: "ID document",
    shared: false,
    purpose:
      "Confirming a driver is a real, licensed person before they can publish rides.",
    storage:
      "Encrypted at rest in Nairobi region storage; visible only to the two-person verification team; never shown to other users.",
    retention: "Until account deletion, then erased within 30 days.",
    required: "Required to offer rides. Not required to book one.",
  },
  {
    name: "Selfie",
    shared: false,
    purpose:
      "Matched against the ID document to prove the account belongs to the document holder.",
    storage:
      "Encrypted at rest, access-logged. Deleted 24 hours after a verification decision is made.",
    retention: "24 hours after the check completes.",
    required: "Required to offer rides.",
  },
  {
    name: "Phone number",
    shared: true,
    purpose:
      "Account identity, OTP sign-in, and letting a matched driver and passenger call each other.",
    storage:
      "Encrypted at rest. Shown to the other party only after a booking is confirmed.",
    retention: "Until account deletion.",
    required: "Required for all accounts.",
  },
  {
    name: "Precise location",
    shared: false,
    purpose:
      "Live ride tracking, arrival detection, and showing nearby departures on the home screen.",
    storage:
      "Encrypted in transit and at rest; collected only while a ride is active and the app is open.",
    retention: "90 days after the trip ends.",
    required: "Optional - the app works without it, live tracking does not.",
  },
  {
    name: "Photos",
    shared: false,
    purpose:
      "Profile photo, and photos you attach to a safety report or a damage dispute.",
    storage:
      "Encrypted at rest. Profile photo is visible to other users; report photos only to our safety team.",
    retention:
      "Profile photo until you change or delete it; report photos 1 year.",
    required: "Optional.",
  },
  {
    name: "Payment info",
    shared: true,
    purpose:
      "Settling the contribution between passenger and driver through MTN or Airtel Money.",
    storage:
      "We store the payer number, amount and reference only. PINs are entered on your SIM toolkit and never reach Twogende.",
    retention: "1 year, for tax and dispute records.",
    required: "Required to pay by mobile money.",
  },
];

/** Reasons offered on the delete screen. Optional - none may be chosen. */
export const DELETION_REASONS = [
  "I don’t travel this route any more",
  "I couldn’t find rides",
  "I had a bad experience",
  "Privacy concerns",
  "Other",
];

/**
 * Fills the placeholders a document carries. Kept here so no screen has to
 * know which strings contain them.
 */
export function fillDoc(
  doc: LegalDoc,
  values: { fee: string; supportEmail: string; privacyEmail: string },
): LegalDoc {
  const fill = (text: string) =>
    text
      .replace(/\{fee\}/g, values.fee)
      .replace(/\{supportEmail\}/g, values.supportEmail)
      .replace(/\{privacyEmail\}/g, values.privacyEmail);

  return {
    ...doc,
    intro: fill(doc.intro),
    sections: doc.sections.map((section) => ({
      heading: section.heading,
      paras: section.paras.map(fill),
    })),
  };
}
