export type IflytekIseEvaluationResponse = {
  code: number;
  message: string;
  sid?: string;
  data?: {
    status?: number;
    data?: string;
  };
};

export type LoadedPronunciationAudioObject = {
  body: Buffer;
  contentType?: string;
  objectKey: string;
};
