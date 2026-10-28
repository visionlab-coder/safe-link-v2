/** Keep source evidence only for the exact current draft. Edits invalidate it, never guess backwards. */
export class TranslationSourceBuffer {
    private display = "";
    private source = "";
    resolve(current: string) { return current.trim() === this.display.trim() ? this.source.trim() : current; }
    append(current: string, displayFragment: string, sourceFragment = displayFragment) {
        const prior = this.resolve(current);
        this.display = [current.trim(), displayFragment.trim()].filter(Boolean).join(" ");
        this.source = [prior.trim(), sourceFragment.trim()].filter(Boolean).join(" ");
        return this.display;
    }
    clear() { this.display = ""; this.source = ""; }
}
