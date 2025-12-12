'use client';
import 'client-only';

import { useRouter } from 'next/navigation';

interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  start: string | null;
  end: string | null;
  htmlLink: string | null;
}

interface ClientPageProps {
  isLoggedIn: boolean;
  userEmail: string | null;
  events: CalendarEvent[];
  fetchError: string | null;
  successMessage: boolean;
  errorMessage: string | undefined;
}

function formatTime(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'All Day';
  const date = new Date(dateString);
  // Check if it's an all-day event (date only, no time component, e.g. 2025-12-10 instead of 2025-12-10T12:15:00+01:00)
  if (dateString.length === 10) {
    return 'All Day';
  }
  return formatTime(dateString);
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function LogOutIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function ClientPage({
  isLoggedIn,
  userEmail,
  events,
  fetchError,
  successMessage,
  errorMessage,
}: ClientPageProps) {
  const router = useRouter();

  const handleLogout = async () => {
    // TODO: @kopach - check if redirect instead of using fetch is better
    await fetch('/api/logout', { method: 'POST' });
    router.refresh();
  };

  const errorMessages: Record<string, string> = {
    oauth_error: 'OAuth authorization was denied or failed.',
    no_code: 'No authorization code received from Google.',
    token_exchange_failed: 'Failed to exchange authorization code for tokens.',
  };

  return (
    <div className="container">
      <header className="header">
        <h1 className="logo">📅 Calendar Scheduler</h1>
        <p className="subtitle">Google OAuth Calendar Demo</p>
      </header>

      {successMessage && (
        <div className="alert alert-success">
          <CheckCircleIcon className="btn-icon" />
          <span>Successfully connected to Google Calendar!</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-error">
          <AlertCircleIcon className="btn-icon" />
          <span>
            {errorMessages[errorMessage] ||
              'An error occurred during authentication.'}
          </span>
        </div>
      )}

      {!isLoggedIn ? (
        <div className="login-container">
          <CalendarIcon className="login-icon" />
          <h2 className="login-title">Connect Your Calendar</h2>
          <p className="login-description">
            Sign in with your Google account to view and manage your calendar
            events. We&apos;ll only access your calendar with your permission.
          </p>
          <a href="/api/auth/google" className="btn btn-primary">
            <GoogleIcon className="btn-icon" />
            Connect Google Calendar
          </a>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Today&apos;s Events</h2>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
              >
                <span className="user-badge">{userEmail}</span>
                <button onClick={handleLogout} className="btn btn-secondary">
                  <LogOutIcon className="btn-icon" />
                  Disconnect Google Calendar
                </button>
              </div>
            </div>

            {fetchError ? (
              <div className="alert alert-error">
                <AlertCircleIcon className="btn-icon" />
                <span>{fetchError}</span>
              </div>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <CalendarIcon className="empty-state-icon" />
                <h3 className="empty-state-title">No events today</h3>
                <p>Your calendar is clear for today. Enjoy your free time!</p>
              </div>
            ) : (
              <div className="events-list">
                {events.map((event) => (
                  <div key={event.id} className="event-item">
                    <span className="event-time">
                      {formatDate(event.start)}
                    </span>
                    <div className="event-details">
                      <div className="event-title">{event.summary}</div>
                      {event.description && (
                        <div className="event-description">
                          {event.description}
                        </div>
                      )}
                    </div>
                    {event.htmlLink && (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="event-link"
                        title="Open in Google Calendar"
                      >
                        <ExternalLinkIcon className="btn-icon" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">API Endpoints</h2>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              <p style={{ marginBottom: '0.75rem' }}>
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  GET /api/reschedule
                </strong>
                <br />
                CRON endpoint to reschedule &quot;test event&quot; events ±15
                minutes
              </p>
              <p style={{ marginBottom: '0.75rem' }}>
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  GET /api/events
                </strong>
                <br />
                Fetch today&apos;s calendar events (requires authentication)
              </p>
            </div>
          </div>
        </>
      )}

      <footer className="footer">
        <p>
          Built with <a href="https://nextjs.org">Next.js</a> and{' '}
          <a href="https://developers.google.com/calendar">
            Google Calendar API
          </a>
        </p>
      </footer>
    </div>
  );
}
