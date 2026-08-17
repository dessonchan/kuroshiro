import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator'

export class CreateActionButtonDto {
  @IsIn(['back', 'left', 'right', 'confirm'])
  button: string

  @IsIn(['display_screen', 'webhook'])
  actionType: string

  @IsOptional()
  @IsUUID()
  screenId?: string

  @IsOptional()
  @IsString()
  webhookUrl?: string

  @IsOptional()
  @IsIn(['GET', 'POST', 'PUT'])
  webhookMethod?: string

  @IsOptional()
  @IsString()
  webhookPayload?: string
}
