from __future__ import annotations

from app.infrastructure.persistence.models import DocumentType, UserDocument

_KYC_DOC_TYPES: frozenset[DocumentType] = frozenset(
    {
        DocumentType.aadhaar,
        DocumentType.pan,
        DocumentType.signature,
        DocumentType.bank_statement,
        DocumentType.address_proof,
        DocumentType.nominee_id,
    }
)

_DEFAULT_KYC_RETENTION_DAYS = 1825


def data_class_for_doc_type(doc_type: DocumentType) -> str:
    if doc_type == DocumentType.profile_image:
        return "profile_pii"
    return "kyc_documents"


def is_kyc_doc_type(doc_type: DocumentType) -> bool:
    return doc_type in _KYC_DOC_TYPES


def document_is_immutable(document: UserDocument) -> bool:
    return document.immutable_at is not None


def document_has_legal_hold(document: UserDocument) -> bool:
    return bool(document.legal_hold)


def user_may_delete_document(document: UserDocument) -> bool:
    return not document_is_immutable(document) and not document_has_legal_hold(document)


def admin_may_delete_document(document: UserDocument) -> bool:
    return not document_has_legal_hold(document)
