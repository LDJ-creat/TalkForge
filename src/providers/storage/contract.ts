import type { ProviderIdentity } from "../types";
import type {
  CreateDownloadUrlInput,
  CreateUploadTargetInput,
  DeleteObjectInput,
  DownloadUrl,
  ObjectExistsInput,
  UploadTarget,
} from "./types";

export interface StorageProvider extends ProviderIdentity {
  createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget>;
  createDownloadUrl(input: CreateDownloadUrlInput): Promise<DownloadUrl>;
  deleteObject(input: DeleteObjectInput): Promise<void>;
  objectExists?(input: ObjectExistsInput): Promise<boolean>;
}
