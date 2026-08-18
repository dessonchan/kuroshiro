import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddScheduleSupport1786700000000 implements MigrationInterface {
  name = 'AddScheduleSupport1786700000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Device: offSchedule (simple-json, nullable)
    await queryRunner.query(`ALTER TABLE "device" ADD COLUMN "offSchedule" text DEFAULT NULL`)
    // Device: timezone (text, default 'UTC')
    await queryRunner.query(`ALTER TABLE "device" ADD COLUMN "timezone" text NOT NULL DEFAULT 'UTC'`)
    // Device: screenSaverScreenId (uuid, nullable)
    await queryRunner.query(`ALTER TABLE "device" ADD COLUMN "screenSaverScreenId" uuid DEFAULT NULL`)
    // Screen: enableSchedule (simple-json, nullable)
    await queryRunner.query(`ALTER TABLE "screen" ADD COLUMN "enableSchedule" text DEFAULT NULL`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "screen" DROP COLUMN "enableSchedule"`)
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "screenSaverScreenId"`)
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "timezone"`)
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "offSchedule"`)
  }
}