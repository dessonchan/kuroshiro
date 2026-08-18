import { IsOptional, IsString } from 'class-validator'

export class UpdateScreenDto {
  @IsOptional()
  @IsString()
  filename?: string

  @IsOptional()
  @IsString()
  html?: string

  @IsOptional()
  enableSchedule?: any
}