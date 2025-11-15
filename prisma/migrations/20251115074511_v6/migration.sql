/*
  Warnings:

  - Added the required column `amount_calculated` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amount_final` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `time_used_minutes` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "amount_calculated" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "amount_final" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "method" "PaymentMethod",
ADD COLUMN     "receipt_number" TEXT,
ADD COLUMN     "time_used_minutes" INTEGER NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'PEN';
