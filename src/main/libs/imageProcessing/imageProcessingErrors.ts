export const ImageProcessingErrorCode = {
  MissingSource: 'missing_source',
  MissingProject: 'missing_project',
  MissingInputItem: 'missing_input_item',
  UnknownPreset: 'unknown_preset',
  UnsupportedFormat: 'unsupported_format',
  MissingFile: 'missing_file',
  CorruptImage: 'corrupt_image',
  OutputWouldOverwrite: 'output_would_overwrite',
  OutputExists: 'output_exists',
  PlanNotFound: 'plan_not_found',
  JobNotFound: 'job_not_found',
  ExecutionNotImplemented: 'execution_not_implemented',
} as const;

export type ImageProcessingErrorCode =
  typeof ImageProcessingErrorCode[keyof typeof ImageProcessingErrorCode];

export class ImageProcessingError extends Error {
  code: ImageProcessingErrorCode;

  constructor(code: ImageProcessingErrorCode, message: string) {
    super(message);
    this.name = 'ImageProcessingError';
    this.code = code;
  }
}
