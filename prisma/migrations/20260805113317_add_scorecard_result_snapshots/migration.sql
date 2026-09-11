-- AlterTable
ALTER TABLE "ScorecardCriterionResult" ADD COLUMN     "criterionMaxSnapshot" INTEGER,
ADD COLUMN     "criterionNameSnapshot" TEXT,
ADD COLUMN     "criterionOrderSnapshot" INTEGER,
ADD COLUMN     "criterionWeightSnapshot" INTEGER;
