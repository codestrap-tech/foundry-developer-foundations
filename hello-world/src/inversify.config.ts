import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from '@hello/types';
import { openWeatherService } from '@hello/services/weatherService';
import { createFoundryClient } from '@hello/services/foundryClient';
import { makeWorldDao } from '@hello/domain/worldDao';
import { makeUserDao } from '@hello/domain/userDao';

export const container = new Container();

container
  .bind(TYPES.FoundryClient)
  .toDynamicValue(createFoundryClient)
  .inSingletonScope();

container.bind(TYPES.WorldDao).toConstantValue(makeWorldDao());

container.bind(TYPES.UserDao).toConstantValue(makeUserDao());

container.bind(TYPES.WeatherService).toConstantValue(openWeatherService);
