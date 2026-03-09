import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const defaultCorsOrigins = "http://localhost:3001,http://127.0.0.1:3001,http://localhost:3000,http://127.0.0.1:3000";
  const corsOrigins = (process.env.CORS_ORIGINS ?? defaultCorsOrigins)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
