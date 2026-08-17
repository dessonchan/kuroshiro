import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddActionButtonSupport1786600000000 implements MigrationInterface {
  name = 'AddActionButtonSupport1786600000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add buttons column to device table (JSON array of button names)
    await queryRunner.query(`
      ALTER TABLE "device"
      ADD COLUMN "buttons" text DEFAULT '[]'
    `)

    // Create action_button table
    await queryRunner.query(`
      CREATE TABLE "action_button" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "button" text NOT NULL,
        "actionType" text NOT NULL,
        "screenId" uuid,
        "webhookUrl" text,
        "webhookMethod" text,
        "webhookPayload" text,
        "deviceId" uuid NOT NULL,
        CONSTRAINT "PK_action_button" PRIMARY KEY ("id"),
        CONSTRAINT "FK_action_button_device" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_action_button_screen" FOREIGN KEY ("screenId") REFERENCES "screen"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `)

    // Create unique constraint: one action config per button per device
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_action_button_device_button" ON "action_button" ("deviceId", "button")
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_action_button_device_button"`)
    await queryRunner.query(`DROP TABLE "action_button"`)
    await queryRunner.query(`ALTER TABLE "device" DROP COLUMN "buttons"`)
  }
}
