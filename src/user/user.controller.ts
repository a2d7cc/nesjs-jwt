import { Controller, Get } from '@nestjs/common'
import { Auth } from '../auth/decorators/auth.decorator'

import { UserService } from './user.service'

@Controller('users')
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Get('profile')
	@Auth()
	async getProfile() {
		return this.userService.byId()
	}
}
