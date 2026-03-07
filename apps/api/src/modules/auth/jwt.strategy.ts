import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService } from "./auth.service";

type JwtPayload = {
  sub: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? "weekly-report-dev-secret"
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.verifyUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException("用户不存在");
    }
    return user;
  }
}
