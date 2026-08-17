import { Body, Controller, Delete, Get, Headers, HttpException, HttpStatus, Logger, Param, Patch, Post, UsePipes, ValidationPipe } from '@nestjs/common'
import { ActionButtonService } from './action-button.service'
import { ActionRequestHeadersDto } from './dto/action-request-headers.dto'
import { CreateActionButtonDto } from './dto/create-action-button.dto'
import { UpdateActionButtonDto } from './dto/update-action-button.dto'

@Controller('')
export class ActionButtonController {
  private readonly logger = new Logger(ActionButtonController.name)

  constructor(private readonly actionButtonService: ActionButtonService) {}

  /**
   * Firmware calls this endpoint when a button is pressed.
   * GET /api/action/:button — button is one of: back, left, right, confirm
   */
  @Get('action/:button')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  async handleAction(
    @Param('button') button: string,
    @Headers() headers: ActionRequestHeadersDto,
  ): Promise<any> {
    const result = await this.actionButtonService.handleAction(
      button,
      headers.id,
      headers['access-token'],
      headers['x-buttons'],
    )
    // If no action is configured for this button, return 204 No Content
    if (!result)
      throw new HttpException('', HttpStatus.NO_CONTENT)

    return result
  }

  /**
   * CRUD endpoints for managing action button configs via the UI.
   * These are called from the device settings page.
   */
  @Get('devices/:deviceId/action-buttons')
  async getActionButtons(@Param('deviceId') deviceId: string) {
    return this.actionButtonService.getActionButtonsForDevice(deviceId)
  }

  @Post('devices/:deviceId/action-buttons')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createActionButton(
    @Param('deviceId') deviceId: string,
    @Body() dto: CreateActionButtonDto,
  ) {
    return this.actionButtonService.createActionButton(deviceId, dto)
  }

  @Patch('action-buttons/:id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateActionButton(
    @Param('id') id: string,
    @Body() dto: UpdateActionButtonDto,
  ) {
    return this.actionButtonService.updateActionButton(id, dto)
  }

  @Delete('action-buttons/:id')
  async deleteActionButton(@Param('id') id: string) {
    return this.actionButtonService.deleteActionButton(id)
  }
}
