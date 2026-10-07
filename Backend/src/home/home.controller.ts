import {
  Controller,
  Get,
  Put,
  Request,
  Body,
  SerializeOptions,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { HomeService } from './home.service';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { SessionCheckGuard } from '../roles/session-check.guard';
import { I18n, I18nContext } from 'nestjs-i18n';
import { Public } from '../roles/public.decorator';

@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.user)
@UseGuards(RolesGuard, SessionCheckGuard)
@ApiTags('Home')
@Controller({
  path: '',
  version: '1',
})
export class HomeController {
  constructor(private service: HomeService) {}

  @Get()
  appInfo(@I18n() i18n: I18nContext) {
    const message = i18n.translate('home.WELCOME_MESSAGE');
    return { message, appInfo: this.service.appInfo() };
  }

  @Get('get-initial-data')
  @SerializeOptions({
    groups: ['admin', 'me'],
  })
  async InitialData(@Request() request, @I18n() i18n: I18nContext) {
    return await this.service.initialData(request.user, i18n);
  }
}
