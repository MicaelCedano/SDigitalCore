-- La nota de crédito es un documento operativo y debe conservar su numeración e historial.
ALTER TYPE "warranty_document_type" ADD VALUE IF NOT EXISTS 'CREDIT_NOTE';
