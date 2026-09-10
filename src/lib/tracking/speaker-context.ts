import { getContext, setContext } from 'svelte';

export type SpeakerMeasurement = {
	name: string;
	action?: string;
	section?: string;
	metric?: number;
};
export type SpeakerTracking = { measure: (event: SpeakerMeasurement) => void };
const key = Symbol('speaker-tracking');
export const provideSpeakerTracking = (tracking: SpeakerTracking) => setContext(key, tracking);
// Other renderers and editor previews deliberately have no tracking context.
export const getSpeakerTracking = () => getContext<SpeakerTracking | undefined>(key);
