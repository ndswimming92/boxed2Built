import React from 'react';

interface NAPData {
  businessName: string;
  phone: string;
  email: string;
  address: {
    streetAddress?: string;
    addressLocality: string;
    addressRegion: string;
    postalCode?: string;
    addressCountry: string;
  };
  serviceAreas: string[];
  website: string;
}

interface NAPConsistencyProps {
  data: NAPData;
  showAddress?: boolean;
  showServiceAreas?: boolean;
  className?: string;
  variant?: 'header' | 'footer' | 'contact' | 'inline';
}

const NAPConsistency: React.FC<NAPConsistencyProps> = ({
  data,
  showAddress = true,
  showServiceAreas = false,
  className = '',
  variant = 'inline'
}) => {
  const { businessName, phone, email, address, serviceAreas } = data;

  const formatPhone = (phoneNumber: string) => {
    // Format phone number consistently: (931) 674-1196
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const number = cleaned.substring(1);
      return `(${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
    }
    return phoneNumber;
  };

  const formatAddress = () => {
    const parts = [];
    if (address.streetAddress) parts.push(address.streetAddress);
    parts.push(`${address.addressLocality}, ${address.addressRegion}`);
    if (address.postalCode) parts.push(address.postalCode);
    return parts.join(', ');
  };

  const baseClasses = {
    header: 'text-sm text-gray-700',
    footer: 'text-sm text-gray-300',
    contact: 'text-base text-gray-700',
    inline: 'text-sm text-gray-600'
  };

  const linkClasses = {
    header: 'text-blue-700 hover:text-blue-800',
    footer: 'text-gray-300 hover:text-white',
    contact: 'text-blue-700 hover:text-blue-800',
    inline: 'text-blue-700 hover:text-blue-800'
  };

  return (
    <div 
      className={`${baseClasses[variant]} ${className}`}
      itemScope
      itemType="https://schema.org/LocalBusiness"
    >
      <meta itemProp="name" content={businessName} />
      <meta itemProp="telephone" content={phone} />
      <meta itemProp="email" content={email} />
      <meta itemProp="url" content={data.website} />
      
      <div className="space-y-1">
        {/* Business Name */}
        <div className="font-semibold" itemProp="name">
          {businessName}
        </div>

        {/* Phone */}
        <div>
          <a 
            href={`tel:${phone}`}
            className={`${linkClasses[variant]} transition-colors`}
            itemProp="telephone"
            aria-label={`Call ${businessName} at ${formatPhone(phone)}`}
          >
            {formatPhone(phone)}
          </a>
        </div>

        {/* Email */}
        <div>
          <a 
            href={`mailto:${email}`}
            className={`${linkClasses[variant]} transition-colors`}
            itemProp="email"
            aria-label={`Email ${businessName}`}
          >
            {email}
          </a>
        </div>

        {/* Address */}
        {showAddress && (
          <div 
            itemProp="address" 
            itemScope 
            itemType="https://schema.org/PostalAddress"
          >
            <meta itemProp="streetAddress" content={address.streetAddress || ''} />
            <meta itemProp="addressLocality" content={address.addressLocality} />
            <meta itemProp="addressRegion" content={address.addressRegion} />
            <meta itemProp="postalCode" content={address.postalCode || ''} />
            <meta itemProp="addressCountry" content={address.addressCountry} />
            
            <span>{formatAddress()}</span>
          </div>
        )}

        {/* Service Areas */}
        {showServiceAreas && serviceAreas.length > 0 && (
          <div className="mt-2">
            <div className="font-medium mb-1">Service Areas:</div>
            <div className="text-xs">
              {serviceAreas.join(' • ')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NAPConsistency;