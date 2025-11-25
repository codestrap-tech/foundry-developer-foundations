// Set up the mock response
export const mockProgrammerResponse1 = `[
    {
        "id": "sendEmail|13",
        "transitions": [
            {
                "on": "CONTINUE",
                "target": "success"
            },
            {
                "on": "ERROR",
                "target": "failure"
            }
        ]
    },
    {
        "id": "success",
        "type": "final"
    },
    {
        "id": "failure",
        "type": "final"
    }
]`;
