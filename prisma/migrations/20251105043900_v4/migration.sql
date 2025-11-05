-- AlterTable
ALTER TABLE "ParkingCode" ADD COLUMN     "space_id" INTEGER;

-- AddForeignKey
ALTER TABLE "ParkingCode" ADD CONSTRAINT "ParkingCode_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "ParkingSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
