// ADMINISTRATION_PASS3.md — extracted from OsintPage.tsx's Phone
// Intelligence country-code <select> (previously defined inline there)
// so the preferences modal can offer the identical list instead of
// duplicating it. Keep in sync with any future additions — there is
// exactly one source of truth for this list now.
export interface PhoneCodeOption {
    label: string;
    value: string;
}

export const PHONE_CODES: PhoneCodeOption[] = [
    { label: 'Malaysia (+60)',            value: '+60' },
    { label: 'Singapore (+65)',           value: '+65' },
    { label: 'Indonesia (+62)',           value: '+62' },
    { label: 'Thailand (+66)',            value: '+66' },
    { label: 'Philippines (+63)',         value: '+63' },
    { label: 'Vietnam (+84)',             value: '+84' },
    { label: 'India (+91)',               value: '+91' },
    { label: 'United Kingdom (+44)',      value: '+44' },
    { label: 'United States/Canada (+1)', value: '+1'  }
];
