import React from 'react';

type SplitFlapNumberProps = {
  value: string;
  shouldAnimate?: boolean;
  ariaLabel?: string;
};

const isDigit = (char: string) => /^\d$/.test(char);

const placeholderFor = (input: string) =>
  input
    .split('')
    .map((char) => (isDigit(char) ? '0' : char))
    .join('');

const SplitFlapNumber: React.FC<SplitFlapNumberProps> = ({ value, shouldAnimate = true, ariaLabel }) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => {
      mediaQuery.removeEventListener('change', updatePreference);
    };
  }, []);

  // Respect reduced-motion by skipping split-flap transition frames and showing the final value immediately.
  const displayValue = shouldAnimate || prefersReducedMotion ? value : placeholderFor(value);

  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={ariaLabel ?? value}>
      <span className="sr-only">{ariaLabel ?? value}</span>
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        {displayValue.split('').map((char, index) => {
          if (isDigit(char)) {
            return (
              <span
                key={`${char}-${index}`}
                className="splitflap-cell inline-flex flex-col rounded-md overflow-hidden border border-gray-300 bg-white text-gray-950 shadow-sm"
              >
                <span className="splitflap-top block px-2 py-0.5 leading-none">{char}</span>
                <span className="splitflap-bottom block px-2 py-0.5 leading-none border-t border-gray-300">{char}</span>
              </span>
            );
          }

          return (
            <span key={`${char}-${index}`} className="splitflap-cell splitflap-separator inline-flex items-center px-1 text-gray-900">
              {char}
            </span>
          );
        })}
      </span>
    </span>
  );
};

export default SplitFlapNumber;
