import { TYPES, WeatherService, UserDao, WorldDao } from '@hello/types';
import { container } from '@hello/inversify.config';

export async function writeGreeting(city: string): Promise<string> {
  // example of consuming an vanilla service
  const getWeather = container.get<WeatherService>(TYPES.WeatherService);
  const weather = await getWeather(city);

  // example dao usage
  const user = await container.get<UserDao>(TYPES.UserDao)();
  const greeting = await container.get<WorldDao>(TYPES.WorldDao)({
    message: weather,
    userId: user.id,
  });

  return `weather: ${weather}\nuser: ${user} greeting: ${greeting}`;
}
