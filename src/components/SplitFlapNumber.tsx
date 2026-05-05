import React from 'react';

type SplitFlapNumberProps = {
  value: string;
};

const isDigit = (char: string) => /^\d$/.test(char);

const SplitFlapNumber: React.FC<SplitFlapNumberProps> = ({ value }) => {
  return (
    <span className="inline-flex items-center gap-1" aria-label={value}>
      {value.split('').map((char, index) => {
        if (isDigit(char)) {
          return (
            <span key={`${char}-${index}`} className="splitflap-cell inline-flex flex-col rounded-md overflow-hidden border border-gray-200 bg-white shadow-sm" aria-hidden="true">
              <span className="splitflap-top block px-2 py-0.5 leading-none">{char}</span>
              <span className="splitflap-bottom block px-2 py-0.5 leading-none border-t border-gray-200">{char}</span>
            </span>
          );
        }

        return (
          <span key={`${char}-${index}`} className="splitflap-cell splitflap-separator inline-flex items-center px-1" aria-hidden="true">
            {char}
          </span>
        );
      })}
    </span>
  );
};

export default SplitFlapNumber;
