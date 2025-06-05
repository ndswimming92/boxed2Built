import React from 'react';
import { Facebook, Mail, Phone } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-900 text-white pt-12 pb-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between mb-8">
          <div className="mb-8 md:mb-0">
            <div className="flex items-center mb-4">
              <img 
                src="/Modern Minimalist Logo for Boxed2Built.png" 
                alt="Boxed2Built Logo" 
                className="h-12 w-auto"
              />
            </div>
            <p className="text-gray-400 max-w-md mb-6">
              Professional furniture assembly in Spring Hill, TN and surrounding areas. From box to built, we make home setup quick, easy, and stress-free.
            </p>
            <div className="flex space-x-4">
              <a 
                href="https://www.facebook.com/profile.php?id=61576975580738" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-blue-700 hover:bg-blue-800 transition-colors p-2 rounded-full"
                aria-label="Facebook"
              >
                <Facebook size={20} />
              </a>
              <a 
                href="mailto:boxed2builtco@gmail.com" 
                className="bg-red-600 hover:bg-red-700 transition-colors p-2 rounded-full"
                aria-label="Email"
              >
                <Mail size={20} />
              </a>
              <a 
                href="tel:6154034538" 
                className="bg-green-600 hover:bg-green-700 transition-colors p-2 rounded-full"
                aria-label="Phone"
              >
                <Phone size={20} />
              </a>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Home</a>
                </li>
                <li>
                  <a href="#about" className="text-gray-400 hover:text-white transition-colors">About</a>
                </li>
                <li>
                  <a href="#services" className="text-gray-400 hover:text-white transition-colors">Services</a>
                </li>
                <li>
                  <a href="#testimonials" className="text-gray-400 hover:text-white transition-colors">Testimonials</a>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact</h3>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <Phone size={16} className="mr-2 text-gray-400" />
                  <a href="tel:6154034538" className="text-gray-400 hover:text-white transition-colors">
                    (615) 403-4538
                  </a>
                </li>
                <li className="flex items-center">
                  <Mail size={16} className="mr-2 text-gray-400" />
                  <a href="mailto:boxed2builtco@gmail.com" className="text-gray-400 hover:text-white transition-colors">
                    boxed2builtco@gmail.com
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-800 pt-6 mt-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 text-sm">
              &copy; {currentYear} Boxed2Built. All rights reserved.
            </p>
            <p className="text-gray-500 text-sm mt-2 md:mt-0">
              Serving Spring Hill, TN and surrounding areas
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
