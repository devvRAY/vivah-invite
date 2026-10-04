import {
  Component, ElementRef, OnDestroy, ViewEncapsulation,
  computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { CONFIG_URL, InviteConfig, Theme, isTheme, musicUrl, rich } from './config';
import { Photo } from './photo';
import { Rsvp } from './rsvp';

const HINTS: Record<Theme, string> = {
  a: 'Tap the seal to open',
  b: 'Tap the moon to open',
  c: 'Untie the thread to open',
};
const KICKERS: Record<Theme, string> = {
  a: 'You are invited',
  b: 'An invitation from the stars',
  c: 'Shubh Vivah',
};

@Component({
  selector: 'app-root',
  imports: [Photo, Rsvp],
  templateUrl: './app.html',
  encapsulation: ViewEncapsulation.None, // all styling lives in src/styles.scss
})
export class App implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly urlTheme = new URLSearchParams(location.search).get('theme')?.toLowerCase();

  protected readonly rich = rich;
  protected readonly cfg = signal<InviteConfig | null>(null);
  protected readonly error = signal('');

  /** ?theme=a|b|c wins, then "theme" in the config, then c */
  protected readonly theme = computed<Theme>(() => {
    if (isTheme(this.urlTheme)) return this.urlTheme;
    const t = this.cfg()?.theme;
    return isTheme(t) ? t : 'c';
  });
  protected readonly hint = computed(() => this.cfg()?.stage.hint || HINTS[this.theme()]);
  protected readonly kicker = computed(() => this.cfg()?.stage.kicker || KICKERS[this.theme()]);

  // ----- envelope stage -----
  protected readonly opened = signal(false);
  protected readonly done = signal(false);
  protected readonly gone = signal(false);
  private timers: ReturnType<typeof setTimeout>[] = [];
    private audio?: HTMLAudioElement;
  protected readonly hasMusic = signal(false);
  protected readonly playing = signal(false);

  protected toggleMusic() {
    const a = this.audio;
    if (!a) return;
    if (a.paused) a.play().then(() => this.playing.set(true)).catch(() => {});
    else { a.pause(); this.playing.set(false); }
  }

  protected open() {
    if (this.opened()) return;
    this.opened.set(true);
    this.audio?.play().then(() => this.playing.set(true)).catch(() => this.playing.set(false));
    this.timers.push(setTimeout(() => this.done.set(true), 3000));
    this.timers.push(
      setTimeout(() => {
        this.gone.set(true);
        document.documentElement.style.overflow = '';
      }, 4300),
    );
  }

  // ----- countdown -----
  private readonly now = signal(Date.now());
  private readonly tick = setInterval(() => this.now.set(Date.now()), 1000);
  private readonly target = computed(() => new Date(this.cfg()?.wedding.dateTime ?? 0).getTime());
  protected readonly finished = computed(() => this.now() >= this.target());
  protected readonly units = computed(() => {
    const s = Math.floor(Math.max(0, this.target() - this.now()) / 1000);
    const days = Math.floor(s / 86400);
    const u = (label: string, n: number, pct: number) => ({
      label,
      text: String(n).padStart(2, '0'),
      p: pct.toFixed(1),
    });
    return [
      u('Days', days, Math.min(100, (days / 120) * 100)),
      u('Hours', Math.floor((s % 86400) / 3600), (Math.floor((s % 86400) / 3600) / 24) * 100),
      u('Minutes', Math.floor((s % 3600) / 60), (Math.floor((s % 3600) / 60) / 60) * 100),
      u('Seconds', s % 60, ((s % 60) / 60) * 100),
    ];
  });

  // ----- derived view data -----
  /** "2026-12-25T18:00..." -> "25 · 12 · 2026" (read from the string so viewer time zone can't shift it) */
  protected readonly shortDate = computed(() => {
    const [y, m, d] = (this.cfg()?.wedding.dateTime ?? '').slice(0, 10).split('-');
    return y ? `${d} · ${m} · ${y}` : '';
  });
  protected readonly people = computed(() => {
    const c = this.cfg();
    if (!c) return [];
    return [
      { p: c.people.bride, photo: c.photos.bride, rev: false, label: 'Bride photo' },
      { p: c.people.groom, photo: c.photos.groom, rev: true, label: 'Groom photo' },
    ];
  });
  protected readonly sides = computed(() => {
    const i = this.cfg()?.invitation;
    return [i?.brideSide, i?.groomSide].filter((s) => !!s);
  });
  protected readonly hasMapsLink = computed(() => {
    const u = this.cfg()?.wedding.venue.mapsUrl;
    return !!u && !u.includes('REPLACE_WITH');
  });
  protected readonly mapEmbed = computed(() => {
    const u = this.cfg()?.wedding.venue.mapsEmbedUrl;
    return u ? this.sanitizer.bypassSecurityTrustResourceUrl(u) : null; // URL is authored by you, in the config
  });

  // ----- starfield (theme b) -----
  private readonly stars = viewChild<ElementRef<HTMLCanvasElement>>('stars');
  private raf = 0;

  constructor() {
    this.load();
    document.addEventListener('visibilitychange', () => {
      const a = this.audio;
      if (!a || !this.opened()) return;
      if (document.hidden) a.pause();
      else if (this.playing()) a.play().catch(() => {});
    });
    effect(() => {
      const cv = this.stars()?.nativeElement;
      if (cv) this.startStars(cv);
    });
  }

  private async load() {
    try {
      const res = await fetch(CONFIG_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const c = (await res.json()) as InviteConfig;
      document.title = c.pageTitle || `${c.names.bride} & ${c.names.groom}`;
      document.documentElement.style.overflow = 'hidden'; // locked until the envelope opens
      if (c.music?.file) {
        const a = new Audio(musicUrl(c.music.file));
        a.loop = true;
        a.preload = 'auto';
        a.volume = Math.min(1, Math.max(0, c.music.volume ?? 0.6));
        this.audio = a;
        this.hasMusic.set(true);
      }
      this.cfg.set(c);
    } catch (e) {
      this.error.set(`Could not load ${CONFIG_URL} (${e instanceof Error ? e.message : e}).`);
    }
  }

  private startStars(cv: HTMLCanvasElement) {
    const ctx = cv.getContext('2d')!;
    let W = 0, H = 0;
    let st: { x: number; y: number; r: number; p: number; s: number }[] = [];
    const size = () => {
      const r = cv.getBoundingClientRect();
      if (!r.width) return;
      W = cv.width = r.width;
      H = cv.height = r.height;
      st = Array.from({ length: Math.round((W * H) / 2600) }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.2 + 0.2, p: Math.random() * 6, s: Math.random() + 0.4,
      }));
    };
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#f6efe0';
      for (const s of st) {
        ctx.globalAlpha = this.reduced ? 0.7 : 0.4 + 0.5 * Math.sin((t / 900) * s.s + s.p);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.3);
        ctx.fill();
      }
      if (!this.reduced && !this.gone()) this.raf = requestAnimationFrame(draw);
    };
    size();
    window.addEventListener('resize', size);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(draw);
  }

  ngOnDestroy() {
    clearInterval(this.tick);
    cancelAnimationFrame(this.raf);
    this.timers.forEach(clearTimeout);
    this.audio?.pause();
  }
}
