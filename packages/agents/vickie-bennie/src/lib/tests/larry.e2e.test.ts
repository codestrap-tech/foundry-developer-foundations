import { Larry } from '../Larry';

if (!process.env.E2E) {
    test.skip('e2e test skipped in default run', () => {
        // won't run
    });
} else {
    describe('testing Larry', () => {
        beforeAll(() => {
            jest.clearAllMocks();
        });

        it('It should retrieve my calendar events for tomorrow', async () => {
            const larry = new Larry();

            const result = await larry.askLarry(`I need to create a search google drive function for the office service`,
                process.env.FOUNDRY_TEST_USER
            );
            expect(result.executionId).toBeDefined();
            expect(result.message).toBeDefined();
            expect(result.status).toBe(200);
        }, 60000);
    })
}