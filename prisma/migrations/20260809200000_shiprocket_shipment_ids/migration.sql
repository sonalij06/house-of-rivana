-- Shiprocket correlation ids on shipments
ALTER TABLE "Shipment" ADD COLUMN "provider" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "externalOrderId" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "externalShipmentId" TEXT;
CREATE INDEX "Shipment_provider_externalOrderId_idx" ON "Shipment"("provider", "externalOrderId");