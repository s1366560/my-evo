// GEP Component Types
export interface GenePublishFormProps {
  onSuccess?: (geneId: string) => void;
  onCancel?: () => void;
}

export interface CapsulePublishFormProps {
  onSuccess?: (capsuleId: string) => void;
  onCancel?: () => void;
}
