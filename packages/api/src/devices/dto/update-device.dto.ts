import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, ValidateNested, ValidateIf } from 'class-validator'
import { Type } from 'class-transformer'
import { ScheduleConfig } from '../../schedule-config.interface'

class ScheduleConfigDto implements ScheduleConfig {
  @IsString()
  startTime: string

  @IsString()
  endTime: string

  @IsNumber({ each: true })
  weekdays: number[]
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  mac?: string

  @IsOptional()
  @IsString()
  friendlyId?: string

  @IsOptional()
  @IsString()
  batteryVoltage?: string

  @IsOptional()
  @IsString()
  fwVersion?: string

  @IsOptional()
  @IsString()
  host?: string

  @IsOptional()
  @IsNumber()
  refreshRate?: number

  @IsOptional()
  @IsString()
  rssi?: string

  @IsOptional()
  @IsString()
  userAgent?: string

  @IsOptional()
  @IsNumber()
  width?: number

  @IsOptional()
  @IsNumber()
  height?: number

  @IsOptional()
  @IsBoolean()
  mirrorEnabled?: boolean

  @IsOptional()
  @IsString()
  mirrorMac?: string

  @IsOptional()
  @IsString()
  mirrorApikey?: string

  @IsOptional()
  @IsString()
  @IsIn(['none', 'identify', 'sleep', 'add_wifi', 'restart_playlist', 'rewind', 'send_to_me'])
  specialFunction: string

  @IsOptional()
  @IsBoolean()
  resetDevice: boolean

  @IsOptional()
  @IsNumber()
  @IsIn([0, 90, 180, 270])
  rotation?: number

  @IsOptional()
  @IsBoolean()
  updateFirmware: boolean

  @ValidateIf((o) => o.offSchedule !== null && o.offSchedule !== undefined)
  @ValidateNested()
  @Type(() => ScheduleConfigDto)
  offSchedule?: ScheduleConfigDto | null

  @IsOptional()
  @IsString()
  timezone?: string

  @IsOptional()
  @IsString()
  screenSaverScreenId?: string | null
}