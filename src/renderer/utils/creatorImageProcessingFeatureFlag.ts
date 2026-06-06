import {
  CreatorFeatureFlag,
  resolveCreatorFeatureFlag,
} from '@shared/creatorStudio/constants';

export const isCreatorImageProcessingEnabled = (): boolean => {
  try {
    const value = window.localStorage.getItem(CreatorFeatureFlag.ImageProcessingEnabled);
    if (value === 'true') {
      return resolveCreatorFeatureFlag({ [CreatorFeatureFlag.ImageProcessingEnabled]: true }, CreatorFeatureFlag.ImageProcessingEnabled);
    }
    if (value === 'false') {
      return resolveCreatorFeatureFlag({ [CreatorFeatureFlag.ImageProcessingEnabled]: false }, CreatorFeatureFlag.ImageProcessingEnabled);
    }
    return resolveCreatorFeatureFlag(null, CreatorFeatureFlag.ImageProcessingEnabled);
  } catch {
    return resolveCreatorFeatureFlag(null, CreatorFeatureFlag.ImageProcessingEnabled);
  }
};
