-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'KASIR');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('KOPI', 'NON_KOPI', 'TAMBAHAN');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('TUNAI', 'QRIS', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('ACTIVE', 'VOID');

-- CreateEnum
CREATE TYPE "CashEntryType" AS ENUM ('PEMASUKAN', 'PENGELUARAN');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'KASIR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL DEFAULT 'KOPI',
    "price" INTEGER NOT NULL,
    "hpp" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashierId" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'TUNAI',
    "total" INTEGER NOT NULL,
    "totalHpp" INTEGER NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "note" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionItem" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "hpp" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "TransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashEntry" (
    "id" SERIAL NOT NULL,
    "clientId" TEXT,
    "type" "CashEntryType" NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiLog" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "response" JSONB,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_code_key" ON "Transaction"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_clientId_key" ON "Transaction"("clientId");

-- CreateIndex
CREATE INDEX "Transaction_occurredAt_idx" ON "Transaction"("occurredAt");

-- CreateIndex
CREATE INDEX "Transaction_status_occurredAt_idx" ON "Transaction"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "TransactionItem_transactionId_idx" ON "TransactionItem"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionItem_productId_idx" ON "TransactionItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CashEntry_clientId_key" ON "CashEntry"("clientId");

-- CreateIndex
CREATE INDEX "CashEntry_occurredAt_idx" ON "CashEntry"("occurredAt");

-- CreateIndex
CREATE INDEX "AiLog_type_createdAt_idx" ON "AiLog"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashEntry" ADD CONSTRAINT "CashEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

