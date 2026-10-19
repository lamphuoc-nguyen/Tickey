
interface TickeyLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  showText?: boolean;
}

export function TickeyLogo({ size = 'md', variant = 'light', showText = true }: TickeyLogoProps) {
  const badgeSizes = {
    sm: 26,
    md: 32,
    lg: 40,
  };

  const fontSizes = {
    sm: '19px',
    md: '24px',
    lg: '30px',
  };

  const currentBadgeSize = badgeSizes[size];
  const textColor = variant === 'dark' ? '#FFFFFF' : '#20272B';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <div
        style={{
          width: currentBadgeSize,
          height: currentBadgeSize,
          borderRadius: Math.round(currentBadgeSize * 0.28),
          backgroundColor: '#D9422D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(217, 66, 45, 0.25)',
          flexShrink: 0,
        }}
      >
        <svg
          width={Math.round(currentBadgeSize * 0.65)}
          height={Math.round(currentBadgeSize * 0.65)}
          viewBox="0 0 22 22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M13.75 4.58333V6.41666" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" stroke="white" />
          <path d="M13.75 10.0833V11.9167" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" stroke="white" />
          <path d="M13.75 15.5833V17.4167" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" stroke="white" />
          <path
            d="M4.58333 4.58333H17.4167C17.9029 4.58333 18.3692 4.77648 18.713 5.1203C19.0568 5.46412 19.25 5.93043 19.25 6.41666V9.16666C18.7638 9.16666 18.2975 9.35982 17.9536 9.70363C17.6098 10.0474 17.4167 10.5138 17.4167 11C17.4167 11.4862 17.6098 11.9525 17.9536 12.2964C18.2975 12.6402 18.7638 12.8333 19.25 12.8333V15.5833C19.25 16.0696 19.0568 16.5359 18.713 16.8797C18.3692 17.2235 17.9029 17.4167 17.4167 17.4167H4.58333C4.0971 17.4167 3.63079 17.2235 3.28697 16.8797C2.94315 16.5359 2.75 16.0696 2.75 15.5833V12.8333C3.23623 12.8333 3.70255 12.6402 4.04636 12.2964C4.39018 11.9525 4.58333 11.4862 4.58333 11C4.58333 10.5138 4.39018 10.0474 4.04636 9.70363C3.70255 9.35982 3.23623 9.16666 2.75 9.16666V6.41666C2.75 5.93043 2.94315 5.46412 3.28697 5.1203C3.63079 4.77648 4.0971 4.58333 4.58333 4.58333Z"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            stroke="white"
          />
        </svg>
      </div>

      {showText && (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: fontSizes[size],
            fontWeight: 800,
            color: textColor,
            letterSpacing: '-0.02em',
          }}
        >
          tickey
        </span>
      )}
    </div>
  );
}
