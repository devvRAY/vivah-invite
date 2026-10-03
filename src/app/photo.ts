import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { PhotoRef, photoUrl } from './config';

/**
 * Attribute component: put it on the existing frame element, e.g.
 *   <div class="frame" app-photo kind="couple" [photo]="cfg.photos.couple" label="Couple photo"></div>
 * Renders the real photo from private/photos, or the silhouette placeholder if the file is missing.
 */
@Component({
  selector: '[app-photo]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <span class="clip">
      @if (url() && !failed()) {
        <img [src]="url()" [alt]="label()" [style.object-position]="focus()" decoding="async" (error)="failed.set(true)" />
      } @else if (kind() === 'couple') {
        <svg class="ph" viewBox="0 0 160 100" aria-hidden="true">
          <circle cx="58" cy="36" r="14"></circle>
          <path d="M26 100c1-22 13-32 32-32s31 10 32 32z"></path>
          <circle cx="108" cy="32" r="15"></circle>
          <path d="M74 100c1-24 14-34 34-34s33 10 34 34z"></path>
        </svg>
      } @else {
        <svg class="ph" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="38" r="17"></circle>
          <path d="M14 100c2-26 17-38 36-38s34 12 36 38z"></path>
        </svg>
      }
    </span>
    @if (!url() || failed()) {
      <span class="tagp">{{ label() }}</span>
    }
  `,
})
export class Photo {
  readonly photo = input<PhotoRef | undefined>();
  readonly kind = input<'couple' | 'person'>('person');
  readonly label = input('');

  protected readonly failed = signal(false);
  protected readonly url = computed(() => (this.photo()?.file ? photoUrl(this.photo()!.file) : ''));
  protected readonly focus = computed(() => this.photo()?.focus ?? '50% 50%');
}
