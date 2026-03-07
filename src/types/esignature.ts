export interface EsignDocument {
  id: string;
  owner_id: string;
  original_filename: string;
  storage_path: string;
  created_at: string;
}

export interface SigningRequest {
  id: string;
  document_id: string;
  signer_name: string;
  signer_email: string;
  status: string;
  token: string;
  expires_at: string;
  signed_at: string | null;
  signer_ip: string | null;
  created_by_user_id: string | null;
  ngo_id: string | null;
  work_item_id: string | null;
  created_at: string;
}

export interface SigningRequestWithDocument extends SigningRequest {
  esign_documents: { original_filename: string } | null;
}

export interface SignedDocument {
  id: string;
  signing_request_id: string;
  storage_path: string;
  created_at: string;
}

export interface SigningRequestByToken {
  id: string;
  document_id: string;
  signer_name: string;
  signer_email: string;
  status: string;
  token: string;
  expires_at: string;
  signed_at: string | null;
  signer_ip: string | null;
  created_at: string;
  original_filename: string;
  storage_path: string;
}
