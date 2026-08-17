import { IsOptional, IsString } from 'class-validator'

export class ActionRequestHeadersDto {
  @IsString()
  id: string

  @IsString()
  'access-token': string

  @IsOptional()
  @IsString()
  'x-buttons'?: string
}
