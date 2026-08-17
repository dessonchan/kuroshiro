import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Device } from '../devices/devices.entity'
import { DevicesModule } from '../devices/devices.module'
import { Screen } from '../screens/screens.entity'
import { ActionButtonController } from './action-button.controller'
import { ActionButton } from './action-button.entity'
import { ActionButtonService } from './action-button.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([ActionButton, Device, Screen]),
    ConfigModule,
    DevicesModule,
  ],
  controllers: [ActionButtonController],
  providers: [ActionButtonService],
  exports: [ActionButtonService],
})
export class ActionButtonModule {}
