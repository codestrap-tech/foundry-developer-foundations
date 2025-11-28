import { makeLarryStream } from './LarryStream';

describe('LarryStream', () => {
  const LarryStream = makeLarryStream();
  it('should publish and receive messages', () => {
    const received: string[] = [];
    const subscription = LarryStream.subscribe<string>('123', (val) => {
      received.push(val);
    });

    LarryStream.publish({ id: '123', payload: 'Hello' });
    LarryStream.publish({ id: '123', payload: 'World' });

    expect(received).toEqual(['Hello', 'World']);
    expect(subscription.getValue()).toBe('World');

    subscription.unsubscribe();
  });
});