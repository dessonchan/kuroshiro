import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDeviceRotation1786599212204 implements MigrationInterface {
  name = 'AddDeviceRotation1786599212204'
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "device"
      ADD COLUMN "rotation" integer NOT NULL DEFAULT 0
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "device"
      DROP COLUMN "rotation"
    `)
  }
}