import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm'
import { Device } from '../devices/devices.entity'

@Entity()
@Unique('IDX_action_button_device_button', ['deviceId', 'button'])
export class ActionButton {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  button: string // 'back' | 'left' | 'right' | 'confirm'

  @Column('text')
  actionType: string // 'display_screen' | 'webhook'

  // For 'display_screen': the screen ID to display
  @Column('uuid', { nullable: true })
  screenId?: string | null

  // For 'webhook': the URL to call
  @Column('text', { nullable: true })
  webhookUrl?: string | null

  // For 'webhook': HTTP method (GET, POST, PUT)
  @Column('text', { default: 'POST', nullable: true })
  webhookMethod?: string

  // For 'webhook': custom JSON body (POST/PUT) or query params (GET)
  @Column('text', { nullable: true })
  webhookPayload?: string | null

  @Column('uuid')
  deviceId: string

  @ManyToOne(() => Device, device => device.actionButtons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device: Device

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
