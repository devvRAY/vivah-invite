import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { InviteConfig, RSVP_DEFAULTS } from './config';

type Status = 'idle' | 'sending' | 'sent' | 'error';
type Field = 'name' | 'phone' | 'attend' | 'stay';
type Choice = '' | 'yes' | 'no';

@Component({
  selector: 'app-rsvp',
  templateUrl: './rsvp.html',
  encapsulation: ViewEncapsulation.None, // styles live in src/styles.scss
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Rsvp {
  readonly cfg = input.required<InviteConfig>();

  protected readonly t = computed(() => ({ ...RSVP_DEFAULTS, ...this.cfg().rsvp }));
  protected readonly subtitle = computed(() => {
    const t = this.t();
    if (t.subtitle.includes('{replyBy}') && !t.replyBy) return '';
    return t.subtitle.replace('{replyBy}', t.replyBy);
  });

  protected readonly name = signal('');
  protected readonly phone = signal('');
  protected readonly attending = signal<Choice>('');
  protected readonly guests = signal(0);
  protected readonly stay = signal<Choice>('');
  protected readonly message = signal('');
  protected readonly hp = signal(''); // honeypot, real guests never see or fill this
  protected readonly status = signal<Status>('idle');
  protected readonly attempted = signal(false);
  private readonly touched = signal<Record<string, boolean>>({});

  private readonly digits = computed(() => this.phone().replace(/\D/g, ''));
  protected readonly nameOk = computed(() => this.name().trim().length >= 2);
  protected readonly phoneOk = computed(() => /^[6-9]\d{9}$/.test(this.digits()));
  protected readonly attendOk = computed(() => this.attending() !== '');
  protected readonly stayOk = computed(() => this.attending() !== 'yes' || this.stay() !== '');
  private readonly valid = computed(() => this.nameOk() && this.phoneOk() && this.attendOk() && this.stayOk());

  private readonly firstName = computed(() => this.name().trim().split(/\s+/)[0] ?? '');
  protected readonly thanksTitle = computed(() => {
    const t = this.t();
    return (this.attending() === 'yes' ? t.thanksYesTitle : t.thanksNoTitle).replace('{name}', this.firstName());
  });
  protected readonly thanksBody = computed(() =>
    this.attending() === 'yes' ? this.t().thanksYes : this.t().thanksNo,
  );

  protected val(e: Event) {
    return (e.target as HTMLInputElement).value;
  }
  protected touch(f: Field) {
    this.touched.update((t) => ({ ...t, [f]: true }));
  }
  protected bad(f: Field) {
    if (!(this.attempted() || this.touched()[f])) return false;
    return f === 'name' ? !this.nameOk() : f === 'phone' ? !this.phoneOk() : f === 'attend' ? !this.attendOk() : !this.stayOk();
  }

  /** Keeps digits only, formats as "98765 43210", and strips +91 / leading 0 when pasted. */
  protected onPhone(e: Event) {
    const el = e.target as HTMLInputElement;
    const pasted = (e as InputEvent).inputType === 'insertFromPaste';
    let d = el.value.replace(/\D/g, '');
    if (pasted && d.length > 10 && d.startsWith('91')) d = d.slice(2);
    else if (pasted && d.length > 10 && d.startsWith('0')) d = d.slice(1);
    d = d.slice(0, 10);
    const f = d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
    el.value = f;
    this.phone.set(f);
  }

  protected setAttending(v: Choice) {
    this.attending.set(v);
    this.touch('attend');
  }
  protected setStay(v: Choice) {
    this.stay.set(v);
    this.touch('stay');
  }
  protected step(delta: number) {
    this.guests.update((g) => Math.min(this.t().maxGuests, Math.max(0, g + delta)));
  }

  protected reset() {
    this.status.set('idle');
    this.attempted.set(false);
    this.touched.set({});
    this.message.set('');
    this.hp.set('');
  }

  protected async submit(e: Event) {
    e.preventDefault();
    this.attempted.set(true);
    if (!this.valid() || this.status() === 'sending') return;

    const t = this.t();
    if (!t.endpoint) {
      console.warn('rsvp.endpoint is missing in invite.config.json');
      this.status.set('error');
      return;
    }

    this.status.set('sending');
    const yes = this.attending() === 'yes';
    const body = new URLSearchParams({
      name: this.name().trim(),
      phone: this.digits(),
      attending: this.attending(),
      guests: String(yes ? this.guests() : 0),
      accommodation: yes ? this.stay() : '',
      message: this.message().trim(),
      website: this.hp(),
    });

    try {
      // form-encoded body = a "simple" request, so the browser skips the CORS preflight Apps Script can't answer
      const res = await fetch(t.endpoint, { method: 'POST', body });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'rejected');
      this.status.set('sent');
      setTimeout(() => document.getElementById('rsvp')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
    } catch (err) {
      console.error('RSVP failed', err);
      this.status.set('error');
    }
  }
}