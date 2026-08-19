import { isArtifactSlug } from '$lib/artifacts/contract';

export function match(param: string): boolean {
	return isArtifactSlug(param);
}
