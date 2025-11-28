# LarryStream

Simple pub/sub stream store.

## API

### publish

```typescript
LarryStream.publish({ id: 'my-stream', payload: { data: 'hello' } });
```

### subscribe

```typescript
const subscription = LarryStream.subscribe('my-stream', (value) => {
  console.log(value);
});

// Get current value
const current = subscription.getValue();

// Stop listening
subscription.unsubscribe();
```

## Example

```typescript
import { makeLarryStream } from './LarryStream';

const LarryStream = makeLarryStream();

// Subscribe first
const subscription = LarryStream.subscribe<string>('chat-123', (message) => {
  console.log('New message:', message);
});

// Publish updates
LarryStream.publish({ id: 'chat-123', payload: 'Hello' });
LarryStream.publish({ id: 'chat-123', payload: 'World' });

// Get last value
console.log(subscription.getValue()); // 'World'

// Clean up
subscription.unsubscribe();
```

