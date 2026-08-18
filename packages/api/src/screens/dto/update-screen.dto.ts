import { IsNumber, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator'
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

export class UpdateScreenDto {
  @IsOptional()
  @IsString()
  filename?: string

  @IsOptional()
  @IsString()
  html?: string

  @ValidateIf((o) => o.enableSchedule !== null && o.enableSchedule !== undefined)
  @ValidateNested()
  @Type(() => ScheduleConfigDto)
  enableSchedule?: ScheduleConfigDto | null
}