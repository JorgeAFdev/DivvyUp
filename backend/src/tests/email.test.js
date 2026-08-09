const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('resend', () => ({
    Resend: vi.fn(() => ({ emails: { send: sendMock } }))
}));

const { default: sendEmail } = await import('../services/email.js');

describe('sendEmail', () => {
    beforeEach(() => {
        sendMock.mockReset();
        process.env.RESEND_API_KEY = 'test-key';
        delete process.env.RESEND_FROM;
    });

    it('sends from the DivvyUp test sender and passes to/subject/text through', async () => {
        sendMock.mockResolvedValue({ data: { id: 'x' }, error: null });

        await sendEmail('user@example.com', 'Hi', 'Body');

        expect(sendMock).toHaveBeenCalledWith({
            from: 'DivvyUp <onboarding@resend.dev>',
            to: 'user@example.com',
            subject: 'Hi',
            text: 'Body'
        });
    });

    it('uses RESEND_FROM when it is set', async () => {
        process.env.RESEND_FROM = 'DivvyUp <noreply@send.jorgeaf.dev>';
        sendMock.mockResolvedValue({ data: {}, error: null });

        await sendEmail('user@example.com', 'S', 'T');

        expect(sendMock.mock.calls[0][0].from).toBe('DivvyUp <noreply@send.jorgeaf.dev>');
    });

    it('throws when Resend returns an error', async () => {
        sendMock.mockResolvedValue({ data: null, error: { message: 'boom' } });

        await expect(sendEmail('user@example.com', 'S', 'T')).rejects.toThrow('boom');
    });
});
