import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService, AuthUser } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

type LoginRequest = {
  username: string;
  password: string;
};
type AuthenticatedRequest = Request & { user: AuthUser };

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: LoginRequest) {
    return this.authService.login(body.username, body.password);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: Request) {
    return (request as AuthenticatedRequest).user;
  }

  @Post("logout")
  @HttpCode(200)
  logout() {
    return { success: true };
  }
}
