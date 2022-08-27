import {
	BadRequestException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common'
import { ModelType } from '@typegoose/typegoose/lib/types'
import { InjectModel } from 'nestjs-typegoose'
import { UserModel } from '../user/user.model'
import { AuthDto } from './dto/auth.dto'
import { hash, genSalt, compare } from 'bcryptjs'
import { JwtService } from '@nestjs/jwt'
import { refreshToken } from './dto/refreshToken.dto'

@Injectable()
export class AuthService {
	constructor(
		@InjectModel(UserModel) private readonly UserModel: ModelType<UserModel>,
		private readonly jwtService: JwtService
	) {}

	async registration(dto: AuthDto) {
		const { email, password } = dto

		const oldUser = await this.UserModel.findOne({ email })
		if (oldUser) {
			throw new BadRequestException(
				'User with this email is already exist in the system'
			)
		}

		const salt = await genSalt(4)
		const newUser = new this.UserModel({
			email,
			password: await hash(password, salt),
		})

		const tokens = await this.issueTokenPair(String(newUser._id))

		return {
			user: this.returnUserFields(newUser),
			...tokens,
		}
	}

	async login(dto: AuthDto) {
		const user = await this.validateUser(dto)

		const tokens = await this.issueTokenPair(String(user._id))

		return {
			user: this.returnUserFields(user),
			...tokens,
		}
	}

	async validateUser(dto: AuthDto): Promise<UserModel> {
		const { email, password } = dto

		const user = await this.UserModel.findOne({ email })
		if (!user) {
			throw new UnauthorizedException('The credentials are incorrect')
		}

		const isValidPassword = await compare(password, user.password)
		if (!isValidPassword) {
			throw new UnauthorizedException('The credentials are incorrect')
		}

		return user
	}

	async issueTokenPair(userId: string) {
		const data = { _id: userId }
		const refreshToken = await this.jwtService.signAsync(data, {
			expiresIn: '15d',
		})
		const accessToken = await this.jwtService.signAsync(data, {
			expiresIn: '1h',
		})

		return { refreshToken, accessToken }
	}

	returnUserFields(user: UserModel) {
		return {
			_id: user.id,
			email: user.email,
			isAdmin: user.isAdmin,
		}
	}

	async getNewTokens({ refreshToken }: refreshToken) {
		if (!refreshToken) {
			throw new UnauthorizedException('Please sign in')
		}

		const result = await this.jwtService.verifyAsync(refreshToken)
		if (!result) {
			throw new UnauthorizedException()
		}
		const user = await this.UserModel.findById(result._id)

		if (!user) {
			throw new BadRequestException(
				'User with this payload from JWT not founded'
			)
		}

		const tokens = await this.issueTokenPair(String(user._id))
		return {
			user: this.returnUserFields(user),
			...tokens,
		}
	}
}
