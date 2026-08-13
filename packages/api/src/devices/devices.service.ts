import type { Repository } from 'typeorm'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as fs from 'node:fs'
import * as path from 'node:path'
import generateApikey from '../utils/generateApikey'
import generateFriendlyName from '../utils/generateFriendlyName'
import { resolveAppPath } from '../utils/pathHelper'
import { Device } from './devices.entity'
import { CreateDeviceDto } from './dto/create-device.dto'
import { Screen } from '../screens/screens.entity'

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name)

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(Screen)
    private screenRepository: Repository<Screen>,
  ) {}

  async findAll(): Promise<Device[]> {
    return this.deviceRepository.find({ order: { friendlyId: 'ASC' } })
  }

  async findById(id: string): Promise<Device | null> {
    return this.deviceRepository.findOneBy({ id })
  }

  async create(device: CreateDeviceDto): Promise<Device> {
    const friendlyId = generateFriendlyName()
    const apikey = generateApikey()
    const newDevice = this.deviceRepository.create({ ...device, friendlyId, apikey })
    return this.deviceRepository.save(newDevice)
  }

  async update(id: string, newDevice: Partial<Device>): Promise<Device> {
    const dbDevice = await this.deviceRepository.findOneBy({ id })
    if (!dbDevice)
      return null

    // If rotation changed, invalidate all screen caches and delete device PNGs
    if (newDevice.rotation !== undefined && newDevice.rotation !== dbDevice.rotation) {
      this.logger.log(`Rotation changed for device ${id}: ${dbDevice.rotation} → ${newDevice.rotation}. Clearing screen cache.`)
      // Clear cached plugin output for all screens of this device
      await this.screenRepository.update({ device: { id } }, { cachedPluginOutput: null })
      // Delete all PNG files in the device directory
      const deviceDir = resolveAppPath('public', 'screens', 'devices', id)
      if (fs.existsSync(deviceDir)) {
        const files = fs.readdirSync(deviceDir)
        for (const file of files) {
          if (file.endsWith('.png')) {
            fs.unlinkSync(path.join(deviceDir, file))
            this.logger.log(`Deleted ${file}`)
          }
        }
      }
    }

    Object.assign(dbDevice, newDevice)
    return this.deviceRepository.save(dbDevice)
  }

  async remove(id: string): Promise<boolean> {
    const dbDevice = await this.deviceRepository.findOneBy({ id })
    if (!dbDevice)
      return false
    await this.deviceRepository.remove(dbDevice)
    return true
  }
}