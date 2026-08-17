import { IsArray } from 'class-validator'

/**
 * Matches the TRMNL firmware log payload format:
 * { "logs": [{ "id": 1, "message": "...", ... }] }
 *
 * The firmware serialises each log entry with `id` as the log identifier
 * (see serialize_log.cpp: json_log["id"] = input.logId).
 * Additional fields (message, wifi_signal, etc.) are allowed and stored as JSON.
 */
export class CreateLogDto {
  @IsArray()
  logs: any[]
}