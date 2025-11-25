import { WeatherService } from '@hello/types';

export const openWeatherService: WeatherService = async (city) => {
  const key = process.env.OPEN_WEATHER_API_KEY!;
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city,
    )}&appid=${key}&units=metric`,
  );
  const result = (await res.json()) as {
    weather: { description: string }[];
    main: { temp: string };
  };
  return `${result.weather[0].description}, ${result.main.temp} °C`;
};
