import React from 'react';

export type ContentLang = 'en' | 'ar';

interface Props {
  value: ContentLang;
  onChange: (lang: ContentLang) => void;
  /** Shows a dot on the Arabic tab when it already holds content. */
  arabicFilled?: boolean;
}

/** A plain two-way toggle between the English and Arabic field sets of a form. */
export const ContentLanguageTabs: React.FC<Props> = ({ value, onChange, arabicFilled }) => (
  <div role="tablist" aria-label="Content language"
       className="inline-grid grid-cols-2 gap-1 rounded-xl bg-brand-sand/50 p-1">
    {([['en', 'English'], ['ar', 'Arabic']] as const).map(([id, label]) => {
      const active = value === id;
      return (
        <button
          key={id}
          type="button"                       // must not submit the surrounding <form>
          role="tab"
          aria-selected={active}
          onClick={() => onChange(id)}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
            active
              ? 'bg-brand-charcoal text-brand-cream shadow-sm'
              : 'text-brand-charcoal/60 hover:bg-brand-sand'
          }`}
        >
          {label}
          {id === 'ar' && arabicFilled && (
            <span aria-hidden className="ms-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand-sage" />
          )}
        </button>
      );
    })}
  </div>
);
