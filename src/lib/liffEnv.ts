// A LINE MINI App has three LIFF apps (Developing, Review, Published), each with its own LIFF ID,
// and liff.init() must get the ID of the environment the user actually came in through. All three
// endpoint URLs can point at this one deployment; the Review and Published ones carry ?env=... so
// the app knows which ID to use. No parameter means Developing.

export type LiffEnv = 'developing' | 'review' | 'published';

export interface LiffIds {
  developing: string;
  review?: string;
  published?: string;
}

export function liffEnvFrom(search: string, remembered: string | null): LiffEnv {
  const asked = new URLSearchParams(search).get('env');
  for (const v of [asked, remembered]) {
    if (v === 'review' || v === 'published' || v === 'developing') return v;
  }
  return 'developing';
}

/** The ID for `env`, or the Developing one if that environment's ID was never configured. */
export function liffIdFor(env: LiffEnv, ids: LiffIds): string {
  return ids[env] || ids.developing;
}
