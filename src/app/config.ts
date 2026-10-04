export type Theme = 'a' | 'b' | 'c';

export const isTheme = (x: unknown): x is Theme => x === 'a' || x === 'b' || x === 'c';

export interface PhotoRef {
  file: string;
  /** CSS object-position, e.g. "50% 30%" */
  focus?: string;
}

export interface Host {
  names: string;
  relation: string;
}

export interface Side {
  heading: string;
  hosts: Host[];
}

export interface Person {
  role: string;
  name: string;
  marathi: string;
  about: string;
  facts: { label: string; value: string }[];
}

export interface InviteConfig {
  theme?: string;
  names: { bride: string; groom: string };
  photos: { couple?: PhotoRef; bride?: PhotoRef; groom?: PhotoRef };
  stage: { ganesh: string; sealText: string; kicker?: string; hint?: string };
  pageTitle?: string;
  music?: { file: string; volume?: number };
  wedding: {
    eventTitle?: string;
    /** ISO string WITH offset, e.g. 2026-12-25T18:00:00+05:30 */
    dateTime: string;
    dateLabel: string;
    timeLabel: string;
    city: string;
    heroMarathi: string;
    countdownNote?: string;
    countdownDoneNote?: string;
    venue: {
      name: string;
      address: string;
      muhuratLine: string;
      notes?: string;
      mapsUrl?: string;
      mapsEmbedUrl?: string;
    };
  };
  invitation: {
    shlok: string;
    greeting: string;
    /** **double asterisks** render as bold */
    body: string;
    english?: string;
    details: { label: string; value: string }[];
    brideSide?: Side;
    groomSide?: Side;
    darshanabhilashi?: { label: string; text: string };
    baldarshanabhilashi?: { label: string; text: string };
    footnote?: string;
  };
  people: { eyebrow: string; bride: Person; groom: Person };
  venueSection: { eyebrow: string; cta: string };
  footer: { shlok: string; text: string };
  rsvp?: RsvpConfig;
}

/** Everything under /private is copied to the site root as /private by angular.json */
export const CONFIG_URL = 'private/invite.config.json';
export const photoUrl = (file: string) =>
  /^(https?:)?\/\//.test(file) ? file : `private/photos/${file}`;

/** Escape HTML, then turn **x** into <b>x</b>. Safe to use with [innerHTML]. */
export function rich(s: string): string {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

export const musicUrl = (file: string) =>
  /^(https?:)?\/\//.test(file) ? file : `private/music/${file}`;

export const RSVP_DEFAULTS = {
  enabled: true,
  endpoint: '',
  replyBy: '',
  maxGuests: 6,
  eyebrow: 'उत्तराची प्रतीक्षा',
  title: 'Will you join us?',
  subtitle: 'Kindly reply by {replyBy}',
  nameLabel: 'Your name',
  nameError: 'Please enter your name',
  phoneLabel: 'How can we reach you?',
  phoneHint: '10-digit mobile number. Only used for venue updates.',
  phoneError: 'Enter a 10-digit mobile number starting with 6–9',
  attendError: 'Please choose one',
  yes: 'Joyfully accepts',
  no: 'Regretfully declines',
  guestsLabel: 'Guests with you',
  stayLabel: 'Will you need help with accommodation?',
  stayYes: 'Yes, please help',
  stayNo: 'No, we have it covered',
  messageLabel: 'A blessing for the couple',
  button: 'Send our reply',
  sending: 'Sending…',
  errorText: 'Something went wrong. Please try again, or call us.',
  thanksYesTitle: 'Thank you, {name}!',
  thanksYes: 'We are delighted you will join us. We will share venue updates on your number.',
  thanksNoTitle: 'Thank you, {name}',
  thanksNo: 'We will miss you, and are grateful for your blessings.',
  editLabel: 'Send another reply',
};
export type RsvpConfig = Partial<typeof RSVP_DEFAULTS>;
