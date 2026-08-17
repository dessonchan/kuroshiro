import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator'

export class UpdateActionButtonDto {
  @IsOptional()
  @IsIn(['display_screen', 'webhook'])
  actionType?: string

  @IsOptional()
  @IsUUID()
  screenId?: string | null

  @IsOptional()
  @IsString()
  webhookUrl?: string | null

  @IsOptional()
  @IsIn(['GET', 'POST', 'PUT'])
  webhookMethod?: string

  @IsOptional()
  @IsString()
  webhookPayload?: string | null
}
