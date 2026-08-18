import { IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
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

export class CreateScreenDto {
  @IsString()
  filename: string

  @IsOptional()
  @IsString()
  externalLink?: string

  @IsString()
  deviceId: string

  @IsOptional()
  @IsBoolean()
  fetchManual: boolean

  @IsOptional()
  @IsString()
  html: string

  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleConfigDto)
  enableSchedule?: ScheduleConfigDto | null
}
