import type { AvatarOption } from './avatar-constants';
import { getAvatarAssetPath } from './avatar-constants';

export function getAvatarSvgDataUrl(option: AvatarOption): string {
  return getAvatarAssetPath(option);
}

/** @deprecated Avatars are bundled PNG assets, not rendered at runtime. */
export function renderAvatarSvg(_option: AvatarOption): string {
  return '';
}
