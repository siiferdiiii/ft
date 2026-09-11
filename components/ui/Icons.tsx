import React from "react";

type IconProps = {
  className?: string;
  size?: number;
};

export const MicIcon: React.FC<IconProps> = ({ className = "w-6 h-6", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <rect x="8" y="2" width="8" height="12" rx="4" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.5 10a1.5 1.5 0 0 1 1.5 1.5c0 3.314 2.686 6 6 6s6-2.686 6-6a1.5 1.5 0 1 1 3 0c0 4.604-3.468 8.4-7.9 8.95v2.05h3.4a1.5 1.5 0 1 1 0 3H7a1.5 1.5 0 1 1 0-3h3.6v-2.05C6.168 19.9 2.7 16.104 2.7 11.5A1.5 1.5 0 0 1 4.5 10z"
    />
  </svg>
);

export const CameraIcon: React.FC<IconProps> = ({ className = "w-5 h-5", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M4 6h3l1.8-2.4c.4-.6 1.1-.9 1.8-.9h4.8c.7 0 1.4.3 1.8.9L19.2 6H20c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H4c-1.7 0-3-1.3-3-3V9c0-1.7 1.3-3 3-3zm8 12c2.8 0 5-2.2 5-5s-2.2-5-5-5-5 2.2-5 5 2.2 5 5 5z" />
    <circle cx="12" cy="13" r="2.5" fill="#FFFFFF" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ className = "w-5 h-5", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 3a1.5 1.5 0 0 1 1.5 1.5v6h6a1.5 1.5 0 1 1 0 3h-6v6a1.5 1.5 0 1 1-3 0v-6h-6a1.5 1.5 0 1 1 0-3h6v-6A1.5 1.5 0 0 1 12 3z"
    />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ className = "w-5 h-5", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.47 5.47a1.5 1.5 0 0 1 2.12 0L12 9.88l4.41-4.41a1.5 1.5 0 1 1 2.12 2.12L14.12 12l4.41 4.41a1.5 1.5 0 0 1-2.12 2.12L12 14.12l-4.41 4.41a1.5 1.5 0 0 1-2.12-2.12L9.88 12 5.47 7.59a1.5 1.5 0 0 1 0-2.12z"
    />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ className = "w-5 h-5", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M20.28 6.22a1.5 1.5 0 0 1 0 2.12l-10 10a1.5 1.5 0 0 1-2.12 0l-5-5a1.5 1.5 0 1 1 2.12-2.12L9.22 15.17l8.94-8.95a1.5 1.5 0 0 1 2.12 0z"
    />
  </svg>
);

export const WalletIcon: React.FC<IconProps> = ({ className = "w-5 h-5", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v1H2V7z" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 10v7a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-7H2zm14 2.5a1.5 1.5 0 0 1 1.5-1.5h3v3h-3a1.5 1.5 0 0 1-1.5-1.5z"
    />
  </svg>
);

export const TransferIcon: React.FC<IconProps> = ({ className = "w-5 h-5", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.5 7.5A1.5 1.5 0 0 1 6 6h11.38l-2.44-2.44a1.5 1.5 0 0 1 2.12-2.12l5 5a1.5 1.5 0 0 1 0 2.12l-5 5a1.5 1.5 0 0 1-2.12-2.12L17.38 9H6a1.5 1.5 0 0 1-1.5-1.5zm15 9A1.5 1.5 0 0 1 18 18H6.62l2.44 2.44a1.5 1.5 0 0 1-2.12 2.12l-5-5a1.5 1.5 0 0 1 0-2.12l5-5a1.5 1.5 0 0 1 2.12 2.12L6.62 15H18a1.5 1.5 0 0 1 1.5 1.5z"
    />
  </svg>
);

export const StatsIcon: React.FC<IconProps> = ({ className = "w-5 h-5", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <rect x="3" y="12" width="4" height="9" rx="1.5" />
    <rect x="10" y="6" width="4" height="15" rx="1.5" />
    <rect x="17" y="3" width="4" height="18" rx="1.5" />
  </svg>
);

export const BudgetIcon: React.FC<IconProps> = ({ className = "w-5 h-5", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path
      d="M12 6.5v11M8.5 9.5h7c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5h-7c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5h7"
      stroke="#FFFFFF"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

export const CategoryIcon: React.FC<IconProps> = ({ className = "w-5 h-5", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3 4.5A1.5 1.5 0 0 1 4.5 3h6a1.5 1.5 0 0 1 1.06.44l8 8a1.5 1.5 0 0 1 0 2.12l-6 6a1.5 1.5 0 0 1-2.12 0l-8-8A1.5 1.5 0 0 1 3 10.5v-6zm4.5 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"
    />
  </svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ className = "w-5 h-5", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M4 4h16a2 2 0 0 1 2 2v2H2V6a2 2 0 0 1 2-2z" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 10v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10H2zm6 3h2v2H8v-2zm6 0h2v2h-2v-2zm-6 4h2v2H8v-2zm6 0h2v2h-2v-2z"
    />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ className = "w-5 h-5", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h5a1.5 1.5 0 0 1 0 3h-1v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7H4a1.5 1.5 0 0 1 0-3h5V3z" />
  </svg>
);

export const EditIcon: React.FC<IconProps> = ({ className = "w-5 h-5", size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M14.06 2.94a2.5 2.5 0 0 1 3.53 0l3.47 3.47a2.5 2.5 0 0 1 0 3.53l-10.6 10.6a2 2 0 0 1-.95.53l-5 1.25a1 1 0 0 1-1.21-1.21l1.25-5c.1-.35.29-.68.53-.95l10.6-10.6z" />
  </svg>
);
