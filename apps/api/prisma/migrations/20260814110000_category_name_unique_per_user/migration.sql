-- DropIndex
DROP INDEX "categories_userId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_name_key" ON "categories"("userId", "name");

