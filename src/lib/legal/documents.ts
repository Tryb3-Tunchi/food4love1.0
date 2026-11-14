// DRAFT LEGAL DOCUMENTS FOR REVIEW. NOT LEGAL ADVICE. NOT APPROVED.
//
// Written from what the application actually does today (verified in the code on
// 2026-11-14). Every fact only the owner can supply is a [BRACKETED PLACEHOLDER];
// nothing was invented. Counsel should review every document before publication.
//
// No imports on purpose: unit-tested with `node --test`.

export const LEGAL = {
  product: 'Food4Love',
  company: '[REGISTERED COMPANY NAME: TO BE CONFIRMED]',
  address: '[REGISTERED BUSINESS ADDRESS: TO BE CONFIRMED]',
  legalEmail: '[LEGAL CONTACT EMAIL: TO BE CONFIRMED]',
  privacyEmail: '[PRIVACY AND DATA REQUEST EMAIL: TO BE CONFIRMED]',
  safetyEmail: '[SAFETY AND TAKEDOWN EMAIL: TO BE CONFIRMED]',
  jurisdiction:
    '[GOVERNING LAW AND COURTS: TO BE CONFIRMED BY COUNSEL, for example the Federal Republic of Nigeria]',
  // Must equal MINIMUM_AGE in src/lib/ageGate.ts (a test checks this).
  minimumAge: 18,
  version: 'draft-1',
  updated: '2026-11-14',
} as const

export interface LegalSection {
  id: string
  heading: string
  // A line starting with "- " is a bullet; every other line is a paragraph.
  body: string[]
}

export interface LegalDocument {
  slug: string
  title: string
  summary: string
  sections: LegalSection[]
  // Decisions the owner or counsel must make before this document can be published.
  decisions: string[]
}

const L = LEGAL

const terms: LegalDocument = {
  slug: 'terms',
  title: 'Terms of Service',
  summary:
    'The rules for using Food4Love once accounts open, and what Food4Love is and is not responsible for.',
  decisions: [
    'Registered company name, address and contact email.',
    'Whether Food4Love is only an introducer, or a party to bookings and payments between members.',
    'Platform fees, wallet and referral-credit rules.',
    'Liability limits and governing law (Nigerian consumer-protection rules limit what can be excluded).',
    'Whether payments must stay on the platform, and the appeal process for suspensions.',
    'The minimum age (18 is proposed and enforced in the app by a one-time confirmation).',
  ],
  sections: [
    {
      id: 'about',
      heading: '1. About these terms',
      body: [
        `${L.product} is operated by ${L.company} (“we”, “us”), of ${L.address}.`,
        'Food4Love is in a pre-launch stage. Joining the public waitlist does not create a Food4Love account and does not make you a member. These terms apply to you once you create an account after launch. If you only join the waitlist, our Privacy Policy and Email Consent page apply to you.',
        'By creating an account you agree to these terms and confirm that you have read our Privacy Policy.',
      ],
    },
    {
      id: 'what',
      heading: '2. What Food4Love is',
      body: [
        'Food4Love is a platform where food lovers and home cooks or private and professional chefs can discover each other, match, message, and arrange food preparation, delivery or related services.',
        `We are ${'[OWNER TO CONFIRM: an intermediary that introduces members / a party to each booking]'}. Unless we say otherwise in writing, the arrangement for food is between the food lover and the cook.`,
        'We do not prepare food. We do not operate a delivery fleet. We do not guarantee the quality, safety, availability, timing or price of any food or service offered by a member, and we do not guarantee that a cook will accept a booking.',
        'Features described in the app may not all be available at the same time or in every city.',
      ],
    },
    {
      id: 'eligibility',
      heading: '3. Who can use Food4Love',
      body: [
        `You must be at least ${L.minimumAge} years old. Food4Love is for adults only. When you first use the app you are asked to confirm your age; we do not ask for your date of birth or an identity document for this.`,
        'You must give accurate information, keep one account only, and not use another person’s account or identity.',
        'We may refuse, suspend or close an account that breaks these terms or the Community Guidelines, or where we reasonably believe it is needed to keep members safe.',
      ],
    },
    {
      id: 'account',
      heading: '4. Your account',
      body: [
        'Keep your login details private. You are responsible for activity on your account. Tell us promptly if you think someone else has accessed it.',
        'You can change your profile and notification choices in Settings. To close your account or ask for your data to be deleted, contact us at the address in section 21 (self-service deletion is not available yet).',
      ],
    },
    {
      id: 'cooks',
      heading: '5. Cooks and chefs',
      body: [
        'If you offer food or services, you are responsible for:',
        '- preparing, storing, packaging and handling food safely and hygienically, and obtaining any licences, registrations or permits the law requires where you operate;',
        '- describing your food accurately, including ingredients and allergens;',
        '- honouring bookings you confirm, or cancelling in good time;',
        '- paying any tax that applies to your earnings.',
        'A “Verified” badge means a cook completed our identity-verification process (an identity document, an ID number and a short video, reviewed by our team). It does not mean that we have inspected a kitchen, tested food, checked qualifications or hygiene standards, or insured the cook. Not every cook is verified.',
      ],
    },
    {
      id: 'food-lovers',
      heading: '6. Food lovers',
      body: [
        'You are responsible for giving accurate information about your booking, including the address where a service is to take place, the number of guests, and any allergy or dietary needs.',
        'You must treat cooks and other members with respect and pay for confirmed services.',
      ],
    },
    {
      id: 'allergies',
      heading: '7. Food allergies and dietary needs',
      body: [
        'Tell the cook about every allergy and dietary need before you book, and ask how the food will be prepared. We do not check ingredients, kitchens or allergen controls, and we cannot promise that any food is free from an allergen.',
        'If you have a serious allergy, take your own medical advice and decide whether the food is safe for you. In an emergency, contact your local emergency services.',
      ],
    },
    {
      id: 'meeting',
      heading: '8. Matching, messaging and meeting in person',
      body: [
        'Members can like each other; when both like each other they match and can message. Other members can see the profile details you choose to share and, if you turn on discovery, an approximate area on the map.',
        'People you meet may not be who they say they are. Follow our User Safety and Reporting Guidelines. You are responsible for your own decisions about whom to talk to and meet.',
      ],
    },
    {
      id: 'bookings',
      heading: '9. Bookings, prices and payments',
      body: [
        'A cook sets prices and confirms a booking before payment is requested. The amount to pay is the agreed amount shown to you before you pay. Payments are made in Naira through our payment provider, Paystack, which processes your card or bank details. We do not store full card numbers.',
        `Platform fees and service fees, if any, are shown before you pay: ${'[PLATFORM FEES: TO BE CONFIRMED]'}.`,
        'Refunds and cancellations are described in our Refunds, Cancellations and Subscriptions page. A refund is not always guaranteed.',
        `If we offer a wallet, credits or referral rewards, the rules are: ${'[WALLET AND REFERRAL TERMS: TO BE CONFIRMED]'}.`,
      ],
    },
    {
      id: 'delivery',
      heading: '10. Delivery and private arrangements',
      body: [
        'Food4Love does not deliver food. Where delivery or collection is arranged, it is arranged between the members involved, and the member who arranges it is responsible for it.',
        `Members who agree something outside the app do so at their own risk. ${'[OWNER TO CONFIRM: whether payments outside the platform are prohibited]'}.`,
      ],
    },
    {
      id: 'content',
      heading: '11. Content you share',
      body: [
        'You keep ownership of the photos, videos, posts, stories and text you share. You give us a licence to store, display, adapt for display (for example resize) and share that content on Food4Love so that the service works, for as long as it is on the service.',
        'You must have the right to share what you post. Our Content Policy and Copyright and Takedown Policy explain what is allowed and how to report problems.',
      ],
    },
    {
      id: 'conduct',
      heading: '12. Acceptable use',
      body: [
        'Follow our Community Guidelines. Do not harass, threaten, defraud or impersonate anyone, post unlawful content, collect other members’ data, interfere with the service, or use it to send spam.',
      ],
    },
    {
      id: 'moderation',
      heading: '13. Reports, moderation and suspension',
      body: [
        'Members can report profiles, posts, stories, messages and specials. We review reports and may remove content, limit features, suspend or close accounts, and pass information to the authorities where the law requires or allows.',
        `If your account is suspended and you think that was a mistake, contact us. ${'[APPEAL PROCESS: TO BE CONFIRMED]'}.`,
      ],
    },
    {
      id: 'ip',
      heading: '14. Our intellectual property',
      body: [
        'The Food4Love name, logo, design and software belong to us or our licensors. You may not copy or reuse them without permission.',
      ],
    },
    {
      id: 'third',
      heading: '15. Third-party services',
      body: [
        'Food4Love uses services from others, including payment processing, email delivery, map tiles and hosting. They have their own terms, and we are not responsible for them.',
      ],
    },
    {
      id: 'liability',
      heading: '16. Disclaimers and limits of liability',
      body: [
        '[COUNSEL TO COMPLETE AND REVIEW. Nigerian consumer-protection law may not allow some limits. A draft framework follows.]',
        'The service is provided “as is” to the extent the law allows. Members, not Food4Love, are responsible for the food and services they provide and for what they do offline.',
        `To the extent the law allows, our total liability to you for a claim relating to the service is limited to ${'[LIABILITY CAP: COUNSEL TO SET]'}. Nothing in these terms excludes liability that cannot lawfully be excluded, including for death or personal injury caused by our negligence or for fraud.`,
      ],
    },
    {
      id: 'changes',
      heading: '17. Changes to these terms',
      body: [
        'We may update these terms. If a change is important we will tell you in the app or by email before it takes effect. If you keep using Food4Love after the change, you accept it.',
      ],
    },
    {
      id: 'ending',
      heading: '18. Ending your use',
      body: [
        'You can stop using Food4Love at any time and ask us to close your account. We may keep some information where the law requires or for safety and fraud prevention, as explained in the Privacy Policy.',
      ],
    },
    {
      id: 'law',
      heading: '19. Governing law and disputes',
      body: [`These terms are governed by ${L.jurisdiction}.`],
    },
    {
      id: 'complaints',
      heading: '20. Complaints',
      body: [
        `Contact us first at ${L.legalEmail} and we will try to resolve your complaint. ${'[COMPLAINT HANDLING PROCESS AND TIMES: TO BE CONFIRMED]'}.`,
      ],
    },
    {
      id: 'contact',
      heading: '21. Contact',
      body: [`${L.company}, ${L.address}. Email: ${L.legalEmail}.`],
    },
  ],
}

const privacy: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  summary:
    'What personal information Food4Love collects, why, who sees it, how long we keep it, and your choices.',
  decisions: [
    'Controller identity, address, privacy contact, and whether Food4Love must register with the Nigeria Data Protection Commission.',
    'Lawful basis for each purpose, retention periods, and international-transfer safeguards.',
    'Which AI provider(s) are enabled in production.',
    'Whether national ID numbers should be kept after verification (they are stored today).',
    'Self-service account deletion (not built yet) and the response time for data requests.',
    'Whether UK/EU or US privacy laws apply, based on who actually uses the service.',
  ],
  sections: [
    {
      id: 'who',
      heading: '1. Who we are',
      body: [
        `${L.company} (“Food4Love”, “we”) decides how your personal information is used (the “controller”). Address: ${L.address}. Privacy contact: ${L.privacyEmail}.`,
        'This policy follows the Nigeria Data Protection Act 2023 and is written for people in Nigeria. Where other laws apply to you, you may have additional rights. ' +
          '[COUNSEL TO CONFIRM: NDPC registration, and whether UK GDPR, EU GDPR or US state laws apply based on who uses the service].',
        'Food4Love is in a pre-launch stage. The public waitlist does not create an account. Account features described below apply after launch.',
      ],
    },
    {
      id: 'collect',
      heading: '2. What we collect',
      body: [
        'Waitlist: your email address, whether you are a food lover or a cook, whether you ticked the box for launch updates and when, and a private unsubscribe code. We send you one confirmation email.',
        'Account and profile: your name, email address, phone number if you give one, password (handled by our authentication service; we do not see it), role, profile photos, bio, location text you type, cuisines, prices, and the choices you set in Settings.',
        'Cook verification: an identity document image or PDF, the ID type and number you enter (for example NIN, BVN, passport or driver’s licence), and a short video of your face. These are stored privately and reviewed by authorised staff.',
        'Activity: likes and passes, matches, messages, notifications, stories, posts, reviews, bookings, reports you make or receive, and support conversations.',
        'Payments: payment references, amounts and status. Card and bank details are entered with our payment provider, Paystack; we do not store full card numbers.',
        'Location: your device location is used on your device to centre the map and is not sent to us unless you opt in to discovery. If you opt in, we store only an approximate area (about 2 km), never your exact position. A booking address is shared with the cook you book.',
        'Technical: sign-in cookies, and, only if you accept analytics, a random visitor ID, the page path, the website that referred you, campaign tags, device type, and an approximate country and region taken from your connection. Our code does not store your IP address.',
        'AI features: text you type into an AI feature (for example a food description or a chat suggestion request) is sent to an AI provider to produce the reply.',
      ],
    },
    {
      id: 'why',
      heading: '3. Why we use it',
      body: [
        '- to run your account, show your profile, match you with others and deliver messages (contract);',
        '- to take and confirm payments and handle refunds and disputes (contract and legal obligations);',
        '- to verify cooks, keep members safe, prevent fraud and enforce our rules (legitimate interests, legal obligations);',
        '- to send you the launch updates or product emails you chose to receive (consent), and service emails such as confirmations (contract);',
        '- to understand how the site is used, only if you accept analytics (consent);',
        '- to improve and secure the service (legitimate interests).',
        '[COUNSEL TO CONFIRM the lawful basis for each purpose.]',
      ],
    },
    {
      id: 'map',
      heading: '4. The discovery map',
      body: [
        'Discovery is off for everyone until you switch it on in Settings. If you do, other adult members can see your photo, name, short bio, interests and general area on the map, and the point shown is shifted slightly inside an area of about 2 km so that your exact location is never shown.',
        'You can switch it off at any time; the saved area is deleted straight away.',
      ],
    },
    {
      id: 'share',
      heading: '5. Who sees your information',
      body: [
        'Other members see the profile details you choose to share. Matched members can message you. Cooks see a booking’s details, including the service address.',
        'Our staff can access information where needed to run the service, answer support requests, review reports and safety concerns, and meet legal duties. We do not routinely read private messages.',
        'Service providers that process data for us: Supabase (database, sign-in and file storage), Vercel (hosting), Resend (email), Paystack (payments), OpenStreetMap (map tiles; your browser contacts their servers and they receive your IP address when you open the map), and an AI provider for AI features ' +
          '[CONFIRM WHICH: for example Google Gemini, Groq or xAI].',
        'We may share information with the police or other authorities where the law requires or allows. ' +
          '[OWNER TO CONFIRM: we do not sell personal information.]',
      ],
    },
    {
      id: 'transfers',
      heading: '6. Sending data abroad',
      body: [
        'Some of our providers store or process data outside Nigeria. ' +
          '[COUNSEL TO COMPLETE: the transfer safeguards used under the NDPA.]',
      ],
    },
    {
      id: 'keep',
      heading: '7. How long we keep it',
      body: [
        'Stories expire after a short time. If we run analytics, we delete visit and presence records after ' +
          '[RETENTION PERIOD: the system supports a scheduled purge, default 400 days; to be confirmed and scheduled].',
        '[OWNER TO COMPLETE: retention for accounts, messages, bookings, payments, reports and verification records, including whether ID numbers are deleted after review.]',
        'We may keep some records for longer where the law requires or to prevent fraud and abuse.',
      ],
    },
    {
      id: 'rights',
      heading: '8. Your rights',
      body: [
        'You can ask to see the information we hold about you, correct it, delete it, restrict or object to some uses, withdraw consent, and receive a copy in a common format. You can complain to the Nigeria Data Protection Commission.',
        `Email ${L.privacyEmail}. We will check who you are and reply within ${'[RESPONSE TIME: TO BE CONFIRMED]'}. Self-service account deletion is not available yet, so deletion is handled by request.`,
        'You can unsubscribe from any marketing email using its link, and change email and notification choices in Settings.',
      ],
    },
    {
      id: 'security',
      heading: '9. Keeping information safe',
      body: [
        'We limit who can read each kind of data, keep verification files private with short-lived access links, and use encrypted connections. No system is perfectly secure, so we cannot promise absolute security.',
      ],
    },
    {
      id: 'children',
      heading: '10. Children',
      body: [
        `Food4Love is for adults aged ${L.minimumAge} and over. We do not knowingly accept accounts from children. If you think a child has an account, tell us at ${L.safetyEmail} and we will act.`,
      ],
    },
    {
      id: 'cookies',
      heading: '11. Cookies and analytics',
      body: [
        'See our Cookie Policy. Analytics are off unless you accept, and a browser “Global Privacy Control” signal is treated as a refusal.',
      ],
    },
    {
      id: 'ai',
      heading: '12. AI features',
      body: [
        'AI features give suggestions only. They do not decide who you match with or whether your account is suspended. Do not type sensitive information into them.',
      ],
    },
    {
      id: 'changes',
      heading: '13. Changes and contact',
      body: [
        `We will update this policy when our practices change and tell you about important changes. Contact: ${L.privacyEmail}.`,
      ],
    },
  ],
}

const cookies: LegalDocument = {
  slug: 'cookies',
  title: 'Cookie Policy',
  summary:
    'The small files and browser storage Food4Love uses, which are optional, and how to change your choice.',
  decisions: [
    'Confirm analytics will stay off until this policy and the Privacy Policy are published.',
    'Confirm the analytics retention period.',
  ],
  sections: [
    {
      id: 'necessary',
      heading: '1. Needed to run the service',
      body: [
        'When you sign in, our authentication service stores sign-in cookies (names beginning “sb-”) so you stay signed in. These are needed for the service to work and do not need consent.',
      ],
    },
    {
      id: 'preferences',
      heading: '2. Your preferences on your device',
      body: [
        'Your device’s local storage keeps choices such as your theme, which app tips you have seen, and your saved conversation with the Chef Chi assistant. These stay on your device.',
      ],
    },
    {
      id: 'analytics',
      heading: '3. Analytics (optional, off unless you accept)',
      body: [
        'Analytics are currently switched off. If we switch them on, you will be asked first. Nothing is stored or sent until you press Accept.',
        'If you accept, we store a random visitor ID and a session ID in your browser’s local storage and count page views, which page or campaign brought you, your device type, and an approximate country and region. We send only the page path, never the full address with its query, and our code does not store your IP address. If you are signed in, a visit is linked to your account so that we can show members who are online.',
        'If your browser sends a Global Privacy Control signal, we treat it as “no”.',
      ],
    },
    {
      id: 'third',
      heading: '4. Other companies’ services',
      body: [
        'When you open the map, your browser requests map tiles from OpenStreetMap. When you pay, Paystack’s payment window loads from Paystack. Those companies receive your IP address and may use their own cookies.',
        'Food4Love does not use advertising cookies, tracking pixels, session-replay tools or social-media tracking, and the site’s fonts are served from our own servers.',
      ],
    },
    {
      id: 'choices',
      heading: '5. Your choices',
      body: [
        'You can change your analytics choice at any time using the control on this page, delete cookies and site data in your browser, or turn on Global Privacy Control.',
      ],
    },
  ],
}

const community: LegalDocument = {
  slug: 'community-guidelines',
  title: 'Community Guidelines',
  summary: 'How we expect members to treat each other.',
  decisions: ['Enforcement steps and any appeal process.'],
  sections: [
    {
      id: 'respect',
      heading: '1. Be respectful',
      body: [
        'Treat everyone with courtesy. Do not harass, bully, threaten, stalk or demean anyone. Do not use hate speech or discriminate on the basis of ethnicity, religion, gender, sexual orientation, disability or similar characteristics.',
      ],
    },
    {
      id: 'honest',
      heading: '2. Be honest',
      body: [
        'Use your own name and photos. Do not impersonate others, invent credentials, or claim a certification you do not have. Describe your food, ingredients and allergens truthfully.',
      ],
    },
    {
      id: 'consent',
      heading: '3. Adults, consent and privacy',
      body: [
        `Food4Love is for adults aged ${L.minimumAge}+. Do not share other people’s private information, photos or messages without their permission. Do not pressure anyone for personal or financial details or to meet.`,
      ],
    },
    {
      id: 'safe',
      heading: '4. Keep it safe and legal',
      body: [
        'Do not offer or request anything illegal, dangerous or unsafe, including food you know to be unsafe. Do not use Food4Love to promote scams, send spam, or sell unrelated goods.',
      ],
    },
    {
      id: 'report',
      heading: '5. Report problems',
      body: [
        'Use the Report button on a profile, post, story, message or special. See the User Safety and Reporting Guidelines for what happens next.',
      ],
    },
    {
      id: 'enforce',
      heading: '6. What happens if rules are broken',
      body: [
        'We may remove content, give a warning, limit features, suspend or close accounts, and report serious matters to the authorities. We decide what is proportionate in each case.',
      ],
    },
  ],
}

const content: LegalDocument = {
  slug: 'content-policy',
  title: 'User-Generated Content Policy',
  summary: 'What you can post to Food4Love and how we handle content.',
  decisions: ['Moderation response times and the appeal process.'],
  sections: [
    {
      id: 'allowed',
      heading: '1. What you can post',
      body: [
        'Photos, videos, stories, posts, bios and messages that are yours to share, relate to Food4Love, and follow our Community Guidelines.',
      ],
    },
    {
      id: 'not-allowed',
      heading: '2. What you cannot post',
      body: [
        '- content that is unlawful, threatening, harassing, hateful or sexually explicit;',
        '- content showing or encouraging harm to people or animals;',
        '- any content that shows or involves a person under 18 in a sexual or romantic context, or that endangers a child;',
        '- other people’s private information, or images of someone without their permission;',
        '- content that infringes someone else’s copyright, trademark or other rights;',
        '- false or misleading claims about food safety, ingredients, credentials or reviews;',
        '- malware, spam or links designed to deceive.',
      ],
    },
    {
      id: 'licence',
      heading: '3. Your rights and our licence',
      body: [
        'You own your content. You allow Food4Love to store and display it as described in our Terms. You promise that you have the right to share it.',
      ],
    },
    {
      id: 'moderate',
      heading: '4. How we review content',
      body: [
        'We rely mainly on reports and may also review content ourselves. We may remove or restrict content that breaks these rules, usually without notice where a person’s safety is at risk. Stories disappear after a short time but may be kept for a limited period for safety and legal reasons.',
      ],
    },
    {
      id: 'report',
      heading: '5. Reporting content',
      body: [
        `Use the Report button, or email ${L.safetyEmail}. For copyright complaints, see the Copyright and Takedown Policy.`,
      ],
    },
  ],
}

const copyright: LegalDocument = {
  slug: 'copyright',
  title: 'Copyright and Takedown Policy',
  summary: 'How to tell us that content on Food4Love infringes your copyright.',
  decisions: [
    'Whether to register a designated agent under the US DMCA (only needed to rely on its safe harbour for US-law claims).',
    'The takedown contact email and response times.',
    'How Nigerian copyright law (Copyright Act 2022) applies to notices and counter-notices.',
    'Repeat-infringer thresholds.',
  ],
  sections: [
    {
      id: 'respect',
      heading: '1. Respecting copyright',
      body: [
        'Only share photos, videos, text and other material that you created or have the right to use. Publishing this policy does not by itself protect any person from a claim.',
      ],
    },
    {
      id: 'notice',
      heading: '2. If you think your work has been copied',
      body: [
        `Send a notice to ${L.safetyEmail}, or use the Report button on the content and write “Copyright” at the start of your message. Include:`,
        '- your name and contact details, and the work you say was copied (with a link or description);',
        '- where the content appears on Food4Love (a link or the member’s name);',
        '- a statement that you believe in good faith that the use is not authorised by the owner, the owner’s agent or the law;',
        '- a statement that the information in your notice is accurate and that you are the owner or authorised to act for the owner;',
        '- your signature (typed is fine).',
        'We may remove or disable access to the content while we look into it, and we may tell the member who posted it.',
      ],
    },
    {
      id: 'counter',
      heading: '3. If your content was removed',
      body: [
        `If you believe your content was removed by mistake, contact ${L.safetyEmail} with the content, why you have the right to use it, and your contact details. We may restore content if the person who complained does not take further action within ${'[TIME PERIOD: COUNSEL TO SET]'}.`,
      ],
    },
    {
      id: 'repeat',
      heading: '4. Repeat infringers',
      body: [
        `We may suspend or close the accounts of members who repeatedly infringe copyright. ${'[THRESHOLD: TO BE CONFIRMED]'}.`,
      ],
    },
    {
      id: 'law',
      heading: '5. Applicable law',
      body: [
        '[COUNSEL TO COMPLETE: how the Nigerian Copyright Act 2022 applies, and, if US users make this relevant, the designated agent details under 17 U.S.C. §512(c).]',
        'False claims can have legal consequences. This policy is not legal advice.',
      ],
    },
  ],
}

const refunds: LegalDocument = {
  slug: 'refunds',
  title: 'Refunds, Cancellations and Subscriptions',
  summary:
    'How cancellations and refunds work for bookings, and what we say about subscriptions.',
  decisions: [
    'The cancellation windows and the refund rules for each stage of a booking.',
    'Wallet and referral-credit refund rules.',
    'Who decides a refund in a dispute and how long it takes.',
    'Consumer-protection rights that cannot be excluded.',
  ],
  sections: [
    {
      id: 'how',
      heading: '1. How a booking works',
      body: [
        'A food lover sends a request, the cook confirms it and the agreed price, and only then is payment requested. Payments are in Naira through Paystack.',
      ],
    },
    {
      id: 'cancel',
      heading: '2. Cancelling a booking',
      body: [
        `${'[CANCELLATION WINDOWS AND CHARGES: TO BE CONFIRMED]'}. You should cancel as early as you can and tell the other member.`,
      ],
    },
    {
      id: 'refund',
      heading: '3. Refunds',
      body: [
        'A refund is not always guaranteed. If there is a problem, raise a dispute from the booking or contact support. We review the details and decide whether a full, partial or no refund is due, ' +
          `${'[RULES AND TIMES: TO BE CONFIRMED]'}.`,
        'Approved refunds are sent back through Paystack to the original payment method. Timing depends on Paystack and your bank.',
        'Nothing here limits any right you have under consumer-protection law.',
      ],
    },
    {
      id: 'wallet',
      heading: '4. Wallet credits and referral rewards',
      body: [`${'[WALLET AND REFERRAL CREDIT RULES: TO BE CONFIRMED]'}.`],
    },
    {
      id: 'subs',
      heading: '5. Subscriptions',
      body: [
        'Food4Love does not currently offer subscriptions or automatic renewals, and does not charge your payment method on a recurring basis.',
        'If we ever offer one, we will show the price, how often it is charged, when it renews, and how to cancel before you pay, and we will ask for your clear agreement first.',
      ],
    },
  ],
}

const email: LegalDocument = {
  slug: 'email-consent',
  title: 'Marketing and Email Consent',
  summary:
    'Exactly what you are agreeing to when you join the waitlist or tick the updates box, and how to stop.',
  decisions: [
    'The sender’s registered name and postal address shown in marketing emails (the app refuses to send a campaign until this is configured).',
    'Whether to add a confirmation step before marketing starts (recommended: the form cannot prove who owns an address).',
  ],
  sections: [
    {
      id: 'waitlist',
      heading: '1. Joining the waitlist',
      body: [
        'Joining the waitlist adds your email address to our launch list. It does not create a Food4Love account.',
        'We send one confirmation email so you know your signup worked. That email is a service message, not marketing.',
      ],
    },
    {
      id: 'marketing',
      heading: '2. Launch updates and offers (optional)',
      body: [
        'We only send launch news, product updates or early-member offers if you tick the box asking for them. The box is never ticked for you. We do not subscribe anyone to marketing simply because they joined the waitlist.',
        'Every marketing email has an unsubscribe link, and your email app may show an unsubscribe button. Unsubscribing is one click and takes effect straight away.',
      ],
    },
    {
      id: 'stop',
      heading: '3. Stopping emails',
      body: [
        'Once you unsubscribe, we stop sending marketing to that address. Submitting the waitlist form again does not turn marketing back on. If an email to you bounces permanently or is reported as spam, we stop marketing to that address.',
      ],
    },
    {
      id: 'members',
      heading: '4. Members',
      body: [
        'After you have an account you can turn product updates on or off in Settings. Account and booking emails are service messages and are sent regardless.',
      ],
    },
    {
      id: 'data',
      heading: '5. What we keep',
      body: [
        'We keep your address, whether you agreed to updates and when, and whether you unsubscribed, so that we can honour your choice. See the Privacy Policy.',
        `Questions: ${L.privacyEmail}.`,
      ],
    },
  ],
}

const safety: LegalDocument = {
  slug: 'safety',
  title: 'User Safety and Reporting Guidelines',
  summary: 'How to stay safe, and how to report a problem.',
  decisions: [
    'The safety contact email, review times and escalation routes.',
    'Whether to publish national or local emergency numbers (only after they are verified).',
  ],
  sections: [
    {
      id: 'limits',
      heading: '1. What we can and cannot do',
      body: [
        'Food4Love is for adults. We review cook identity documents, but a “Verified” badge does not mean we have inspected a kitchen, tested food, or checked qualifications, and not every cook is verified. We cannot guarantee anyone’s identity, intentions or food.',
      ],
    },
    {
      id: 'meeting',
      heading: '2. Meeting in person',
      body: [
        '- Chat in the app first and keep conversations on Food4Love where we can help.',
        '- For a first meeting, choose a public place and tell someone you trust where you are going.',
        '- Do not share your bank details, passwords or one-time codes with anyone.',
        '- Be careful about sharing your home address until you are comfortable. If a cook will come to your home, tell someone and trust your instincts.',
        '- Pay through the app where possible. Be cautious of anyone asking you to pay outside it.',
      ],
    },
    {
      id: 'food',
      heading: '3. Food safety and allergies',
      body: [
        'Tell the cook about allergies before you book and ask how the food is prepared. Check that food is stored and served safely. If you feel unwell after eating, seek medical help and report it to us.',
      ],
    },
    {
      id: 'report',
      heading: '4. How to report',
      body: [
        `Use the Report button on a profile, post, story, message or special, or email ${L.safetyEmail}. Tell us what happened and where. You can report without the other member knowing.`,
        'We review reports and may remove content, suspend accounts and, where the law requires or allows, pass information to the authorities. We cannot always tell you the outcome.',
      ],
    },
    {
      id: 'emergency',
      heading: '5. Emergencies',
      body: [
        'If you or someone else is in danger, contact your local emergency services first. Food4Love is not an emergency service.',
      ],
    },
    {
      id: 'children',
      heading: '6. Children',
      body: [
        `Food4Love is only for people aged ${L.minimumAge} and over. If you believe a child is using it, or you see content that endangers a child, report it immediately at ${L.safetyEmail}.`,
      ],
    },
  ],
}

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  terms,
  privacy,
  cookies,
  community,
  content,
  copyright,
  refunds,
  email,
  safety,
]

export function findLegalDocument(slug: string): LegalDocument | null {
  return LEGAL_DOCUMENTS.find((d) => d.slug === slug) ?? null
}

// Splits text so bracketed placeholders can be highlighted for reviewers.
export function splitPlaceholders(
  text: string,
): { text: string; placeholder: boolean }[] {
  const parts: { text: string; placeholder: boolean }[] = []
  const re = /\[[^\]]+\]/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last)
      parts.push({ text: text.slice(last, m.index), placeholder: false })
    parts.push({ text: m[0], placeholder: true })
    last = m.index + m[0].length
  }
  if (last < text.length)
    parts.push({ text: text.slice(last), placeholder: false })
  return parts
}

// Who may see the pages. A merge to the main branch deploys the website, so the
// drafts are HELD on the live site until the owner explicitly publishes them.
//   published  LEGAL_PAGES_PUBLISHED=true (owner approved the text)
//   draft      local development and preview deployments: reviewers see the drafts
//   held       the live site before approval: a neutral "being prepared" page
export type LegalVisibility = 'published' | 'draft' | 'held'

export function legalVisibility(env: {
  LEGAL_PAGES_PUBLISHED?: string
  VERCEL_ENV?: string
}): LegalVisibility {
  if (env.LEGAL_PAGES_PUBLISHED === 'true') return 'published'
  return env.VERCEL_ENV === 'production' ? 'held' : 'draft'
}

// A document that still contains a [PLACEHOLDER] can never be published, even if the
// owner sets LEGAL_PAGES_PUBLISHED=true: the missing facts must be filled in first.
export function documentHasPlaceholders(doc: LegalDocument): boolean {
  const text = [
    doc.title,
    doc.summary,
    ...doc.sections.flatMap((s) => [s.heading, ...s.body]),
  ].join('\n')
  return splitPlaceholders(text).some((part) => part.placeholder)
}

// Publication is all-or-nothing: the documents refer to each other, so none goes live
// until every document in the set is complete.
export function effectiveLegalVisibility(
  env: { LEGAL_PAGES_PUBLISHED?: string; VERCEL_ENV?: string },
  doc: LegalDocument,
  set: LegalDocument[] = LEGAL_DOCUMENTS,
): LegalVisibility {
  const mode = legalVisibility(env)
  if (
    mode === 'published' &&
    (documentHasPlaceholders(doc) || set.some(documentHasPlaceholders))
  )
    return 'held'
  return mode
}
