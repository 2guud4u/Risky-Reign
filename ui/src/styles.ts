/** Shared chrome classes so every modal/backdrop uses one visual language. */

/** The full-screen dim behind a blocking modal (steal, discard, dev-card, battle, victory). */
export const backdropClass = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';

/** The white card a modal renders inside the backdrop. Add a width to size it. */
export const modalCardClass = 'bg-white rounded-xl shadow-2xl p-5 w-full';
/** Small bold label for a section inside a panel or modal. */
export const sectionTitleClass = 'text-[13px] font-semibold text-gray-700';
