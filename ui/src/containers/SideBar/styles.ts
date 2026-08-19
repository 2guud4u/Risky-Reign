/** Shared Tailwind classes for the sidebar panels. */

export const cardClass =
  'w-[280px] border border-gray-300 rounded-lg p-3.5 bg-white flex flex-col gap-3';

export const buildButtonClass = (enabled: boolean) =>
  `px-3 py-2 text-sm rounded-md border border-gray-300 ${
    enabled ? 'bg-blue-600 text-white cursor-pointer' : 'bg-gray-400 cursor-not-allowed'
  }`;

export const hexChipClass = 'inline-block mr-2 px-1.5 py-0.5 rounded bg-gray-100';
