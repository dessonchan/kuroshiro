import { IsArray, IsNumber, IsObject, IsOptional } from 'class-validator'

/**
 * Matches the TRMNL firmware log payload format:
 * { "logs": [{ "log_id": 1, ... }, ...] }
 *
 * Each log entry must have a numeric `log_id`; additional fields are allowed.
 */
export class CreateLogDto {
  @IsArray()
  logs: Array<{ log_id: number } & Record<string, any>>
}