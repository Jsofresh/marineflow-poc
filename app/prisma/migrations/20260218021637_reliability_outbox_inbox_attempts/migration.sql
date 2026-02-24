-- CreateTable
CREATE TABLE "WebhookInbox" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "correlationId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOutbox" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationAttempt" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "correlationId" TEXT,
    "requestHash" TEXT,
    "responseHash" TEXT,
    "responseCode" INTEGER,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookInbox_idempotencyKey_key" ON "WebhookInbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookInbox_source_eventType_createdAt_idx" ON "WebhookInbox"("source", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookInbox_correlationId_idx" ON "WebhookInbox"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOutbox_dedupeKey_key" ON "EventOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "EventOutbox_status_nextAttemptAt_idx" ON "EventOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "EventOutbox_eventType_createdAt_idx" ON "EventOutbox"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "EventOutbox_correlationId_idx" ON "EventOutbox"("correlationId");

-- CreateIndex
CREATE INDEX "IntegrationAttempt_provider_operation_createdAt_idx" ON "IntegrationAttempt"("provider", "operation", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationAttempt_correlationId_idx" ON "IntegrationAttempt"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAttempt_provider_externalKey_key" ON "IntegrationAttempt"("provider", "externalKey");
